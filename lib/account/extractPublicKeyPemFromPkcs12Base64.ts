import forge from "node-forge";

function tryExtract(
  pkcs12Base64: string,
  passphrase: string,
): string | null {
  try {
    const derBytes = forge.util.decode64(pkcs12Base64);
    const asn1 = forge.asn1.fromDer(derBytes);
    const p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, passphrase);
    const bags = p12.getBags({ bagType: forge.pki.oids.certBag })[
      forge.pki.oids.certBag
    ];
    const cert = bags?.[0]?.cert;
    if (!cert?.publicKey) return null;
    return forge.pki.publicKeyToPem(cert.publicKey);
  } catch {
    return null;
  }
}

export function extractPublicKeyPemFromPkcs12Base64(options: {
  pkcs12Base64: string;
  passphrase?: string | null;
}): string {
  const b64 = options.pkcs12Base64.trim();
  if (!b64) throw new Error("Empty PKCS#12");

  // Try the provided passphrase first, then fall back to empty (common for our generated certs),
  // then a final retry with trimmed passphrase.
  const pwRaw = options.passphrase ?? "";
  const pw = typeof pwRaw === "string" ? pwRaw : "";
  const candidates = [pw, "", pw.trim()].filter(
    (v, idx, arr) => arr.indexOf(v) === idx,
  );

  for (const candidate of candidates) {
    const pem = tryExtract(b64, candidate);
    if (pem) return pem;
  }

  throw new Error("Could not extract public key from PKCS#12");
}

