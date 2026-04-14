import "react-native-get-random-values";

import forge from "node-forge";

export type LocalClientPkcs12 = {
  pkcs12Base64: string;
  /** Empty when the PKCS#12 uses an empty password (native import uses ""). */
  passphrase: string;
};

function sanitizeCn(name: string): string {
  const t = name.trim().slice(0, 64);
  return t.length > 0 ? t : "Geminyx Client";
}

/**
 * Generates a self-signed RSA client certificate and PKCS#12 bundle for TLS client auth.
 * The server must trust this certificate (or you must register its public key) for auth to succeed.
 */
export function generateLocalClientPkcs12(options: {
  commonName: string;
}): Promise<LocalClientPkcs12> {
  return new Promise((resolve, reject) => {
    forge.pki.rsa.generateKeyPair({ bits: 2048 }, (err, keypair) => {
      if (err) {
        reject(err);
        return;
      }
      try {
        const cert = forge.pki.createCertificate();
        cert.publicKey = keypair.publicKey;
        cert.serialNumber =
          "01" + forge.util.bytesToHex(forge.random.getBytesSync(8));
        cert.validity.notBefore = new Date();
        cert.validity.notAfter = new Date();
        cert.validity.notAfter.setFullYear(
          cert.validity.notBefore.getFullYear() + 10,
        );

        const cn = sanitizeCn(options.commonName);
        const attrs = [
          { name: "commonName", value: cn },
          { name: "countryName", value: "US" },
          { shortName: "OU", value: "Geminyx" },
        ];
        cert.setSubject(attrs);
        cert.setIssuer(attrs);

        cert.setExtensions([
          { name: "basicConstraints", cA: false },
          {
            name: "keyUsage",
            digitalSignature: true,
            keyEncipherment: true,
          },
          {
            name: "extKeyUsage",
            clientAuth: true,
          },
        ]);

        cert.sign(keypair.privateKey, forge.md.sha256.create());

        /**
         * Apple’s `SecPKCS12Import` is picky about “modern” PKCS#12 crypto.
         * In particular, PKCS#12 blobs protected with AES frequently fail to decode (`errSecDecode` / -26275).
         * Using 3DES here keeps the generated PKCS#12 compatible with iOS Keychain import.
         */
        const p12Asn1 = forge.pkcs12.toPkcs12Asn1(
          keypair.privateKey,
          [cert],
          "",
          {
            algorithm: "3des",
            // Keep defaults modest; this runs on the JS thread.
            saltSize: 8,
            // `count` is the PBKDF iteration count for the key protection.
            // Use a moderate value to balance compatibility and onboarding latency.
            count: 2048,
          },
        );
        const der = forge.asn1.toDer(p12Asn1).getBytes();
        const pkcs12Base64 = forge.util.encode64(der);
        resolve({ pkcs12Base64, passphrase: "" });
      } catch (e) {
        reject(e);
      }
    });
  });
}
