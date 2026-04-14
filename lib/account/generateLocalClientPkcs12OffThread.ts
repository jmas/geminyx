import "react-native-get-random-values";

import type { LocalClientPkcs12 } from "lib/account/generateLocalClientPkcs12";
import { generateLocalClientPkcs12 } from "lib/account/generateLocalClientPkcs12";

type WorkletsImportHandle = {
  __bundleData: { source: number; imported: string };
};

let runtimePromise: Promise<{
  generate: (commonName: string) => Promise<LocalClientPkcs12>;
}> | null = null;

function tryCreateForgeImport(): WorkletsImportHandle | null {
  // `require.resolveWeak` is Metro-specific and is required by Worklets bundle mode.
  // If it's missing, bundle mode isn't active and we should fall back.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rq: any = typeof require !== "undefined" ? require : null;
  const resolveWeak = rq?.resolveWeak;
  if (typeof resolveWeak !== "function") return null;
  try {
    const source = resolveWeak("node-forge");
    // In CommonJS builds, `import forge from "node-forge"` usually maps to `default`.
    // We’ll support both default and module itself on the worker side.
    return { __bundleData: { source, imported: "default" } };
  } catch {
    return null;
  }
}

async function getRuntime() {
  if (runtimePromise) return runtimePromise;
  runtimePromise = (async () => {
    // Lazy import so apps that don't have worklets properly configured can still run.
    const { createWorkletRuntime, runOnRuntime } = await import(
      "react-native-worklets"
    );

    const rt = createWorkletRuntime({ name: "cert-gen", enableEventLoop: true });

    const forgeImport = tryCreateForgeImport();
    if (!forgeImport) {
      throw new Error(
        "Worklets bundle mode not active (missing require.resolveWeak).",
      );
    }

    const generateOnWorker = runOnRuntime(
      rt,
      (forge: unknown, commonName: string): LocalClientPkcs12 => {
        "worklet";
        // `forge` arrives as a Worklets "import" handle, cloned into this runtime.
        // It may be either the module itself or `{ default: ... }` depending on bundling.
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f: any = (forge as any)?.default ?? forge;
        if (!f?.pki?.rsa?.generateKeyPair) {
          throw new Error("node-forge import is not available on worker runtime");
        }

        const cn = (commonName || "").trim().slice(0, 64) || "Geminyx Client";
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const keypair = f.pki.rsa.generateKeyPair({ bits: 2048 });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const cert = f.pki.createCertificate();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        cert.publicKey = keypair.publicKey;
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        cert.serialNumber = "01" + f.util.bytesToHex(f.random.getBytesSync(8));
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        cert.validity.notBefore = new Date();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        cert.validity.notAfter = new Date();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
        cert.validity.notAfter.setFullYear(
          // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access,@typescript-eslint/no-unsafe-call
          cert.validity.notBefore.getFullYear() + 10,
        );

        const attrs = [
          { name: "commonName", value: cn },
          { name: "countryName", value: "US" },
          { shortName: "OU", value: "Geminyx" },
        ];
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        cert.setSubject(attrs);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        cert.setIssuer(attrs);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        cert.setExtensions([
          { name: "basicConstraints", cA: false },
          { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
          { name: "extKeyUsage", clientAuth: true },
        ]);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        cert.sign(keypair.privateKey, f.md.sha256.create());

        // eslint-disable-next-line @typescript-eslint/no-unsafe-call
        const p12Asn1 = f.pkcs12.toPkcs12Asn1(keypair.privateKey, [cert], "", {
          algorithm: "3des",
          saltSize: 8,
          count: 2048,
        });
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const der = f.asn1.toDer(p12Asn1).getBytes();
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call,@typescript-eslint/no-unsafe-member-access
        const pkcs12Base64 = f.util.encode64(der);
        return { pkcs12Base64, passphrase: "" };
      },
    );

    return {
      generate: async (commonName: string) => {
        return await generateOnWorker(forgeImport, commonName);
      },
    };
  })();
  return runtimePromise;
}

/**
 * Best-effort off-thread PKCS#12 generation using Worklets bundle mode.
 * Falls back to the existing on-JS-thread implementation if Worklets aren't configured.
 */
export async function generateLocalClientPkcs12OffThread(options: {
  commonName: string;
}): Promise<LocalClientPkcs12> {
  try {
    const rt = await getRuntime();
    return await rt.generate(options.commonName);
  } catch {
    return await generateLocalClientPkcs12(options);
  }
}

