import { useRouter, type Href } from "expo-router";
import GeminiFetcher, {
  fetchGeminiParsed,
  type GeminiFetchTlsIdentity,
} from "gemini-fetcher";
import { generateLocalClientPkcs12OffThread } from "lib/account/generateLocalClientPkcs12OffThread";
import type { Capsule } from "lib/models/capsule";
import type { ThreadMessage } from "lib/models/threadMessage";
import {
  geminiRequestPathForMessage,
  isCrossOriginGeminiUrl,
  isGeminiInputStatus,
  isGeminiRedirectStatus,
  isGeminiSuccessNonGemtextResource,
  isGeminiTextGeminiResponse,
  normalizeGeminiCapsuleRootUrl,
  resolveGeminiInputPromptUrl,
  resolveGeminiRedirectTarget,
  resolveGeminiRequestUrl,
  suggestedCapsuleNameFromGeminiUrl,
  uint8ArrayToBase64,
} from "lib/models/gemini";
import type { CapsuleCreateVariables } from "lib/resources/capsules";
import type { MessageCreateVariables } from "lib/resources/messages";
import {
  useCallback,
  useRef,
  useState,
  type Dispatch,
  type MutableRefObject,
  type SetStateAction,
} from "react";
import { Alert } from "react-native";
import { alertError, formatError } from "utils/error";
import {
  accountsRepo,
  capsulesRepo,
  threadsRepo,
  messagesRepo,
} from "repositories";
import { logThreadMessage, summarizeRequestUrl } from "utils/threadMessageLog";

const CLIENT_CERT_GENERATE_TIMEOUT_MS = 150_000; // 2.5 minutes

async function withTimeout<T>(
  p: Promise<T>,
  timeoutMs: number,
  message: string,
): Promise<T> {
  let t: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        t = setTimeout(() => reject(new Error(message)), timeoutMs);
      }),
    ]);
  } finally {
    if (t) clearTimeout(t);
  }
}

export type SubmitMessageFlowOptions = {
  fetchUrl?: string;
  fromHome?: boolean;
  /**
   * Optional text to persist/display for the outgoing message.
   * Useful for actions like "Start" / "Visit home" where the request body is empty.
   */
  displayText?: string;
  /**
   * Optional text to use for request URL resolution.
   * Defaults to the provided `text` argument.
   */
  requestText?: string;
};

export type UseMessageCreateParams = {
  threadId: string;
  capsuleUrl: string;
  activeAccountId?: string;
  activeAccountName?: string;
  activeAccountHasClientCert?: boolean;
  threadClientCertShareAllowed?: boolean;
  /** From the active account: PKCS#12 client cert for Gemini TLS (optional). */
  geminiTls?: GeminiFetchTlsIdentity | null;
  onClientCertGenerateStart?: () => void;
  onClientCertGenerateEnd?: (result: { ok: boolean }) => void;
  messagesRef: MutableRefObject<ThreadMessage[]>;
  setMessages: Dispatch<SetStateAction<ThreadMessage[]>>;
  /** e.g. scroll list to end after optimistic append */
  scheduleScrollToEnd: () => void;
  /** Optional hook for parents to refetch local DB–backed UI after mutations. */
  onLocalDataChanged?: () => void | Promise<void>;
  /**
   * When `threadId` is empty, first Visit creates a capsule from this Gemini URL
   * and notifies `onBootstrapThreadId`.
   */
  bootstrapGeminiUrl?: string;
  onBootstrapThreadId?: (capsuleId: string) => void;
};

function isGeminiClientCertRequiredStatus(code: number): boolean {
  return code >= 60 && code <= 69;
}

function isGeminiErrorStatus(code: number): boolean {
  return code >= 40 && code <= 69;
}

function errorBodyFromGeminiResponse(parsed: {
  statusCode: number;
  meta: string;
  body: string;
}): string {
  const metaTrim = parsed.meta.trim();
  const bodyTrim = parsed.body.trim();
  const parts = [metaTrim, bodyTrim].filter((p) => p.length > 0);
  if (parts.length > 0) return parts.join("\n\n");
  return `Request failed (${parsed.statusCode}).`;
}

function geminiIdentityLabelForAccountId(accountId: string): string {
  return `geminyx.gemini.identity.${accountId}`;
}

function confirmAsync(opts: {
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
}): Promise<boolean> {
  return new Promise((resolve) => {
    Alert.alert(opts.title, opts.message, [
      {
        text: opts.cancelText ?? "Cancel",
        style: "cancel",
        onPress: () => resolve(false),
      },
      {
        text: opts.confirmText ?? "OK",
        style: "default",
        onPress: () => resolve(true),
      },
    ]);
  });
}

function newLocalMessageId(prefix: "out" | "in"): string {
  const c = globalThis.crypto;
  if (c?.randomUUID) return `${prefix}-${c.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Inserts thread messages via Refine (`useCreate` / `useMutation` shape) and runs the
 * Gemini fetch → persist outgoing + incoming message flow.
 */
export function useMessageCreate({
  threadId: threadIdProp,
  capsuleUrl,
  activeAccountId,
  activeAccountName,
  activeAccountHasClientCert,
  threadClientCertShareAllowed,
  geminiTls,
  onClientCertGenerateStart,
  onClientCertGenerateEnd,
  messagesRef,
  setMessages,
  scheduleScrollToEnd,
  onLocalDataChanged,
  bootstrapGeminiUrl,
  onBootstrapThreadId,
}: UseMessageCreateParams) {
  const router = useRouter();

  const createCapsuleFromVariables = useCallback(
    async (values: CapsuleCreateVariables): Promise<Capsule> => {
      const active = await accountsRepo.getActive();
      if (!active?.id) {
        throw new Error("No active account");
      }
      return capsulesRepo.insertCapsuleOnly({
        accountId: active.id,
        name: values.name,
        avatarIcon: values.avatarIcon,
        url: values.url,
        description: values.description,
      });
    },
    [],
  );

  const flowBusyRef = useRef(false);
  const [flowPending, setFlowPending] = useState(false);

  const submitMessageFlow = useCallback(
    async (text: string, options?: SubmitMessageFlowOptions) => {
      const requestText = options?.requestText ?? text;
      const displayText = options?.displayText ?? text;
      const trimmedRequestBody = requestText.trim();
      const trimmedDisplayBody = displayText.trim();
      const directFetchUrl = options?.fetchUrl?.trim();
      const flowKind = directFetchUrl
        ? "link"
        : trimmedRequestBody.length === 0
          ? options?.fromHome
            ? "home"
            : "start"
          : "send";

      let threadId = threadIdProp.trim();
      if (!threadId && bootstrapGeminiUrl?.trim()) {
        const bootUrl = bootstrapGeminiUrl.trim();
        const active = await accountsRepo.getActive();
        if (!active?.id) {
          Alert.alert("No account", "Add or select an account first.");
          return;
        }
        try {
          const existing =
            await capsulesRepo.findByGeminiOriginForAccount(active.id, bootUrl);
          const cap =
            existing ??
            (await capsulesRepo.insertCapsuleOnly({
              accountId: active.id,
              name: suggestedCapsuleNameFromGeminiUrl(bootUrl),
              url: normalizeGeminiCapsuleRootUrl(bootUrl) || bootUrl,
            }));
          await threadsRepo.ensureThreadForCapsule(cap.id);
          threadId = cap.id;
          onBootstrapThreadId?.(cap.id);
        } catch (e) {
          logThreadMessage("flow.bootstrap.error", {
            error: formatError(e, "Unknown error."),
          });
          alertError(e, "Could not start.", "Could not start");
          return;
        }
      }

      if (!threadId) {
        logThreadMessage("flow.skip", { reason: "no_thread_id", flowKind });
        return;
      }
      if (flowBusyRef.current) {
        logThreadMessage("flow.skip", {
          reason: "already_busy",
          threadId,
          flowKind,
        });
        return;
      }

      const url = capsuleUrl;
      if (!url) {
        logThreadMessage("flow.blocked", {
          reason: "no_capsule_url",
          threadId,
          flowKind,
        });
        Alert.alert(
          "No capsule URL",
          "Add a Gemini URL to this capsule to start the thread.",
        );
        return;
      }

      await threadsRepo.ensureThreadForCapsule(threadId);

      const prevList = messagesRef.current;
      const prevLast =
        prevList.length > 0 ? prevList[prevList.length - 1] : undefined;

      logThreadMessage("flow.begin", {
        threadId,
        flowKind,
        capsuleUrlSummary: summarizeRequestUrl(url.trim()),
        messageCount: prevList.length,
        lastMessage: prevLast
          ? {
              id: prevLast.id,
              isOutgoing: prevLast.isOutgoing,
              status: prevLast.status,
              metaLen: prevLast.meta?.length ?? 0,
              bodyLen: prevLast.body?.length ?? 0,
              sentAt: prevLast.sentAt,
            }
          : undefined,
        outgoingBodyChars: trimmedDisplayBody.length,
        outgoingContentBytes: new TextEncoder().encode(trimmedDisplayBody)
          .length,
      });

      let requestUrl: string;
      try {
        if (directFetchUrl) {
          requestUrl = directFetchUrl;
        } else {
          requestUrl = resolveGeminiRequestUrl(url, prevLast, requestText);
        }
        logThreadMessage("request_url.resolved", {
          threadId,
          flowKind,
          summary: summarizeRequestUrl(requestUrl),
        });
      } catch (e) {
        logThreadMessage("request_url.error", {
          threadId,
          flowKind,
          error: formatError(e, "Unknown error."),
        });
        console.error(e);
        alertError(e, "Could not build request URL.", "Request");
        return;
      }
      const outgoingRequestPath = geminiRequestPathForMessage(url, requestUrl);
      const outgoingId = newLocalMessageId("out");
      const sentAt = new Date().toISOString();
      const contentLength = new TextEncoder().encode(trimmedDisplayBody).length;
      logThreadMessage("optimistic.outgoing", {
        threadId,
        flowKind,
        outgoingId,
        sentAt,
        contentLength,
        hasBody: trimmedDisplayBody.length > 0,
      });
      const optimisticOut: ThreadMessage = {
        id: outgoingId,
        contentLength,
        sentAt,
        isOutgoing: true,
        requestPath: outgoingRequestPath,
        ...(trimmedDisplayBody.length > 0 ? { body: trimmedDisplayBody } : {}),
      };

      flowBusyRef.current = true;
      setFlowPending(true);
      setMessages((prev) => [...prev, optimisticOut]);
      scheduleScrollToEnd();

      try {
        logThreadMessage("gemini.fetch.begin", {
          threadId,
          flowKind,
          outgoingId,
          requestSummary: summarizeRequestUrl(requestUrl),
        });
        let fetchedUrl = requestUrl;
        // Keep a flow-local TLS value so we can immediately reuse a newly generated cert
        // (and for redirect follow-ups), even if outer account state is still stale.
        let tlsForFlow: GeminiFetchTlsIdentity | undefined =
          geminiTls ?? undefined;
        let parsed = await fetchGeminiParsed(fetchedUrl, tlsForFlow);

        // Client-cert flow:
        // - cert is stored at the account level (PKCS#12 in DB + optional Keychain identity)
        // - when the server returns 6X, generate if missing (once per account)
        // - ask once per thread whether we may share/use it with this server (TLS client auth)
        // - if approved, retry request with cert
        if (
          isGeminiClientCertRequiredStatus(parsed.statusCode) &&
          activeAccountId
        ) {
          const label = geminiIdentityLabelForAccountId(activeAccountId);

          let p12 = tlsForFlow?.pkcs12Base64?.trim() ?? "";
          let passphrase = tlsForFlow?.passphrase ?? "";

          // Avoid relying on potentially stale `activeAccountHasClientCert` from the screen.
          // If we have no PKCS#12 in-hand for this flow, treat it as missing.
          if (!p12.trim()) {
            const ok = await confirmAsync({
              title: "Client certificate required",
              message:
                "This capsule requires a client certificate. Generate one for this account now?",
              confirmText: "Generate",
              cancelText: "Not now",
            });
            if (ok) {
              onClientCertGenerateStart?.();
              // Give React a brief window to paint the modal and start the native-driven
              // progress animation before we begin CPU-heavy work.
              await new Promise<void>((resolve) => setTimeout(resolve, 120));
              try {
                const generated = await withTimeout(
                  generateLocalClientPkcs12OffThread({
                    commonName: activeAccountName?.trim() || "Geminyx Client",
                  }),
                  CLIENT_CERT_GENERATE_TIMEOUT_MS,
                  "Certificate generation timed out (2.5 minutes).",
                );
                p12 = generated.pkcs12Base64;
                passphrase = generated.passphrase;
                await accountsRepo.patch(activeAccountId, {
                  geminiClientP12Base64: p12,
                  geminiClientP12Passphrase: passphrase,
                });
                await onLocalDataChanged?.();
                if (GeminiFetcher?.storeIdentityFromPkcs12) {
                  await GeminiFetcher.storeIdentityFromPkcs12({
                    identityLabel: label,
                    pkcs12Base64: p12,
                    passphrase,
                  });
                }
                tlsForFlow = {
                  identityLabel: label,
                  pkcs12Base64: p12,
                  passphrase,
                };
                onClientCertGenerateEnd?.({ ok: true });
              } catch (certErr) {
                logThreadMessage("gemini.client_cert.generate.error", {
                  threadId,
                  flowKind,
                  error:
                    certErr instanceof Error
                      ? certErr.message
                      : String(certErr),
                });
                Alert.alert(
                  "Client certificate",
                  certErr instanceof Error
                    ? certErr.message
                    : "Could not generate a client certificate.",
                );
                onClientCertGenerateEnd?.({ ok: false });
              }
            }
          }

          const nowHasCert = !!p12.trim();
          let shareAllowed = threadClientCertShareAllowed === true;
          if (nowHasCert && !shareAllowed) {
            const okToShare = await confirmAsync({
              title: "Share certificate with server?",
              message:
                "To access this capsule, Geminyx must present your account’s client certificate during the TLS handshake. Allow this for this thread?",
              confirmText: "Allow",
              cancelText: "Cancel",
            });
            if (okToShare) {
              await threadsRepo.setClientCertShareAllowed(threadId, true);
              shareAllowed = true;
            }
          }

          // Retry only if allowed; otherwise keep the original 6X response (it will be persisted as-is).
          if (nowHasCert) {
            const allowed =
              shareAllowed ||
              (await (async () => {
                const d = await threadsRepo.getById(threadId);
                return d?.clientCertShareAllowed === true;
              })());
            if (allowed) {
              tlsForFlow = {
                identityLabel: label,
                pkcs12Base64: p12,
                passphrase,
              };
              parsed = await fetchGeminiParsed(fetchedUrl, tlsForFlow);
            }
          }
        }

        // Redirect follow: if the server redirects within the same capsule/origin,
        // follow and fetch the final URL so we persist the final content + URL.
        if (capsuleUrl.trim().length > 0) {
          for (
            let i = 0;
            i < 8 && isGeminiRedirectStatus(parsed.statusCode);
            i++
          ) {
            const metaTrim = parsed.meta.trim();
            const target = resolveGeminiRedirectTarget(metaTrim, fetchedUrl);
            if (!/^gemini:\/\//i.test(target)) break;

            // If redirect goes to another Gemini origin, keep existing behavior
            // (create/open another capsule) instead of silently fetching cross-origin.
            if (isCrossOriginGeminiUrl(target, capsuleUrl)) {
              break;
            }

            fetchedUrl = target;
            parsed = await fetchGeminiParsed(fetchedUrl, tlsForFlow);
          }
        }

        logThreadMessage("gemini.fetch.parsed", {
          threadId,
          flowKind,
          outgoingId,
          statusCode: parsed.statusCode,
          metaLen: parsed.meta.length,
          bodyLen: parsed.body.length,
          rawLen: parsed.raw.length,
        });

        const metaTrim = parsed.meta.trim();
        const requestPath = geminiRequestPathForMessage(url, fetchedUrl);

        logThreadMessage("persist.outgoing.begin", {
          threadId,
          flowKind,
          outgoingId,
        });
        const savedOut = await messagesRepo.createFromVariables({
          thread_id: threadId,
          id: outgoingId,
          body:
            trimmedDisplayBody.length > 0 ? trimmedDisplayBody : undefined,
          contentLength,
          sentAt,
          isOutgoing: true,
          requestPath: outgoingRequestPath,
        });
        logThreadMessage("persist.outgoing.done", {
          threadId,
          flowKind,
          outgoingId,
          savedId: savedOut.id,
          savedSentAt: savedOut.sentAt,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === outgoingId ? savedOut : m)),
        );

        if (
          isGeminiRedirectStatus(parsed.statusCode) &&
          capsuleUrl.trim().length > 0
        ) {
          const target = resolveGeminiRedirectTarget(metaTrim, fetchedUrl);
          if (
            /^gemini:\/\//i.test(target) &&
            isCrossOriginGeminiUrl(target, capsuleUrl)
          ) {
            try {
              const active = await accountsRepo.getActive();
              if (!active?.id) {
                Alert.alert("No account", "Add or select an account first.");
                return;
              }
              const existingCap =
                await capsulesRepo.findByGeminiOriginForAccount(
                  active.id,
                  target,
                );
              const normalizedTarget =
                normalizeGeminiCapsuleRootUrl(target) || target;
              const capName = suggestedCapsuleNameFromGeminiUrl(target);
              logThreadMessage("gemini.redirect.new_capsule.begin", {
                threadId,
                flowKind,
                targetSummary: summarizeRequestUrl(target),
                capName,
                existingCapsuleId: existingCap?.id,
              });
              if (existingCap) {
                router.replace({
                  pathname: "/thread/[id]",
                  params: {
                    id: existingCap.id,
                    name: existingCap.name,
                  },
                } as unknown as Href);
                logThreadMessage("gemini.redirect.reuse_capsule", {
                  capsuleId: existingCap.id,
                  flowKind,
                });
                logThreadMessage("flow.success", {
                  threadId,
                  flowKind,
                  outgoingId,
                  redirect: true,
                  reusedCapsule: true,
                });
                return;
              }
              const newCap = await createCapsuleFromVariables({
                name: capName,
                url: normalizedTarget,
              });
              const noticeId = newLocalMessageId("in");
              const noticeSentAt = new Date().toISOString();
              const noticeBody = `Redirected to another Gemini host (${capName}). A new capsule was created — opening it now.`;
              const noticeLen = new TextEncoder().encode(noticeBody).length;
              const savedNotice = await messagesRepo.createFromVariables({
                thread_id: threadId,
                id: noticeId,
                sentAt: noticeSentAt,
                isOutgoing: false,
                requestPath: geminiRequestPathForMessage(
                  capsuleUrl,
                  fetchedUrl,
                ),
                body: noticeBody,
                contentLength: noticeLen,
              });
              setMessages((prev) => [...prev, savedNotice]);
              await onLocalDataChanged?.();
              logThreadMessage("gemini.redirect.new_capsule.done", {
                threadId,
                newCapsuleId: newCap.id,
                flowKind,
              });
              router.replace({
                pathname: "/threads/view",
                params: {
                  url: normalizedTarget,
                  name: newCap.name,
                },
              } as unknown as Href);
              logThreadMessage("flow.success", {
                threadId,
                flowKind,
                outgoingId,
                replyId: noticeId,
                redirect: true,
              });
              return;
            } catch (redirErr) {
              logThreadMessage("gemini.redirect.new_capsule.error", {
                threadId,
                flowKind,
                error: formatError(redirErr, "Unknown error."),
              });
              alertError(
                redirErr,
                "Could not open the other capsule.",
                "Redirect",
              );
            }
          }
        }

        const replyId = newLocalMessageId("in");
        const replySentAt = new Date().toISOString();

        let incomingBody = parsed.body;
        if (isGeminiErrorStatus(parsed.statusCode)) {
          incomingBody = errorBodyFromGeminiResponse(parsed);
        }
        if (isGeminiInputStatus(parsed.statusCode)) {
          const parts: string[] = [];
          if (metaTrim.length > 0) {
            parts.push(metaTrim);
          }
          if (parsed.body.trim().length > 0) {
            parts.push(parsed.body);
          }
          incomingBody = parts.join("\n\n");

          const bodyEmpty = incomingBody.trim().length === 0;
          const promptUrl = bodyEmpty
            ? resolveGeminiInputPromptUrl(parsed.meta, requestUrl)
            : null;

          if (promptUrl) {
            try {
              logThreadMessage("gemini.input.prompt_fetch.begin", {
                threadId,
                flowKind,
                summary: summarizeRequestUrl(promptUrl),
              });
              const promptPage = await fetchGeminiParsed(
                promptUrl,
                geminiTls ?? undefined,
              );
              logThreadMessage("gemini.input.prompt_fetch.done", {
                threadId,
                flowKind,
                statusCode: promptPage.statusCode,
                bodyLen: promptPage.body.length,
              });
              if (
                promptPage.statusCode === 20 &&
                promptPage.body.trim().length > 0
              ) {
                incomingBody = promptPage.body;
              }
            } catch (e) {
              logThreadMessage("gemini.input.prompt_fetch.error", {
                threadId,
                flowKind,
                error: formatError(e, "Unknown error."),
              });
            }
          }

          if (incomingBody.trim().length === 0) {
            const maxBytes = /^\d+$/.test(metaTrim) ? metaTrim : null;
            if (parsed.statusCode === 11) {
              incomingBody = maxBytes
                ? `Sensitive input requested (maximum ${maxBytes} bytes).\n`
                : "Sensitive input requested — type your reply below.\n";
            } else {
              incomingBody = maxBytes
                ? `Please enter your reply (maximum ${maxBytes} bytes).\n`
                : "Please enter your reply below.\n";
            }
          }
        }

        const asGemtext = isGeminiTextGeminiResponse(
          parsed.statusCode,
          parsed.meta,
        );
        const asBlob = isGeminiSuccessNonGemtextResource(
          parsed.statusCode,
          parsed.meta,
        );

        let optimisticIn: ThreadMessage;
        let incomingCreateValues: MessageCreateVariables;

        if (asBlob) {
          const bytes = new TextEncoder().encode(parsed.body);
          const b64 = uint8ArrayToBase64(bytes);
          optimisticIn = {
            id: replyId,
            contentLength: bytes.byteLength,
            sentAt: replySentAt,
            isOutgoing: false,
            requestPath,
            body: "Loading attachment\u2026",
            status: parsed.statusCode,
            ...(metaTrim.length > 0 ? { meta: metaTrim } : {}),
          };
          incomingCreateValues = {
            thread_id: threadId,
            id: replyId,
            sentAt: replySentAt,
            isOutgoing: false,
            requestPath,
            contentLength: 0,
            blobBodyBase64: b64,
            status: parsed.statusCode,
            meta: metaTrim.length > 0 ? metaTrim : undefined,
          };
          logThreadMessage("optimistic.incoming", {
            threadId,
            flowKind,
            replyId,
            replySentAt,
            replyContentLength: bytes.byteLength,
            statusCode: parsed.statusCode,
            metaLen: metaTrim.length,
            bodyLen: parsed.body.length,
            mode: "blob",
          });
        } else {
          const replyBody = incomingBody;
          const replyContentLength = new TextEncoder().encode(replyBody).length;
          optimisticIn = {
            id: replyId,
            contentLength: replyContentLength,
            sentAt: replySentAt,
            isOutgoing: false,
            requestPath,
            body: replyBody.length > 0 ? replyBody : undefined,
            status: parsed.statusCode,
            ...(metaTrim.length > 0 ? { meta: metaTrim } : {}),
          };
          incomingCreateValues = {
            thread_id: threadId,
            id: replyId,
            body: optimisticIn.body,
            contentLength: replyContentLength,
            sentAt: replySentAt,
            isOutgoing: false,
            requestPath,
            status: parsed.statusCode,
            meta: metaTrim.length > 0 ? metaTrim : undefined,
          };
          logThreadMessage("optimistic.incoming", {
            threadId,
            flowKind,
            replyId,
            replySentAt,
            replyContentLength,
            statusCode: parsed.statusCode,
            metaLen: metaTrim.length,
            bodyLen: replyBody.length,
            mode: asGemtext ? "text/gemini" : "text_other",
          });
        }

        setMessages((prev) => [...prev, optimisticIn]);
        scheduleScrollToEnd();

        logThreadMessage("persist.incoming.begin", {
          threadId,
          flowKind,
          replyId,
        });
        const savedIn = await messagesRepo.createFromVariables(
          incomingCreateValues,
        );
        logThreadMessage("persist.incoming.done", {
          threadId,
          flowKind,
          replyId,
          savedId: savedIn.id,
          savedStatus: savedIn.status,
          savedSentAt: savedIn.sentAt,
        });
        setMessages((prev) =>
          prev.map((m) => (m.id === replyId ? savedIn : m)),
        );

        logThreadMessage("invalidate.threads_list", { threadId, flowKind });
        await onLocalDataChanged?.();
        logThreadMessage("flow.success", {
          threadId,
          flowKind,
          outgoingId,
          replyId,
        });
      } catch (e) {
        logThreadMessage("flow.error", {
          threadId,
          flowKind,
          outgoingId,
          error: formatError(e, "Unknown error."),
          stack: e instanceof Error ? e.stack : undefined,
        });
        console.error("Message / Gemini flow failed", e);
        const errText = formatError(e, "Unknown error.");
        const replyId = newLocalMessageId("in");
        const replySentAt = new Date().toISOString();
        const body =
          errText.trim().length > 0 ? errText.trim() : "Unknown error";
        const replyContentLength = new TextEncoder().encode(body).length;
        const optimisticIn: ThreadMessage = {
          id: replyId,
          contentLength: replyContentLength,
          sentAt: replySentAt,
          isOutgoing: false,
          requestPath: outgoingRequestPath,
          body,
          status: 50,
        };
        setMessages((prev) => [...prev, optimisticIn]);
        scheduleScrollToEnd();

        try {
          const savedIn = await messagesRepo.createFromVariables({
            thread_id: threadId,
            id: replyId,
            body,
            contentLength: replyContentLength,
            sentAt: replySentAt,
            isOutgoing: false,
            requestPath: outgoingRequestPath,
            status: 50,
          });
          setMessages((prev) =>
            prev.map((m) => (m.id === replyId ? savedIn : m)),
          );
        } catch (persistErr) {
          logThreadMessage("persist.error_reply.failed", {
            threadId,
            flowKind,
            outgoingId,
            error:
              persistErr instanceof Error
                ? persistErr.message
                : String(persistErr),
          });
        }
      } finally {
        flowBusyRef.current = false;
        setFlowPending(false);
      }
    },
    [
      activeAccountId,
      activeAccountName,
      bootstrapGeminiUrl,
      capsuleUrl,
      createCapsuleFromVariables,
      onBootstrapThreadId,
      threadIdProp,
      threadClientCertShareAllowed,
      geminiTls,
      onLocalDataChanged,
      messagesRef,
      onClientCertGenerateEnd,
      onClientCertGenerateStart,
      router,
      scheduleScrollToEnd,
      setMessages,
    ],
  );

  return {
    flowPending,
    submitMessageFlow,
  };
}

export type UseMessageCreateReturn = ReturnType<typeof useMessageCreate>;
