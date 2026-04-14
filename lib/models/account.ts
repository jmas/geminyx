export type Account = {
  id: string;
  name: string;
  email?: string;
  /** Endpoint for this account’s capsule / backend */
  capsuleUrl?: string;
  /**
   * PKCS#12 bundle (base64), for Gemini servers that require a client certificate (status 60).
   * Paired with {@link geminiClientP12Passphrase} when the archive is encrypted.
   */
  geminiClientP12Base64?: string;
  geminiClientP12Passphrase?: string;
  /** True for the account currently selected in the app (only one at a time) */
  isActive: boolean;
};
