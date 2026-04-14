export type Capsule = {
  id: string;
  name: string;
  /** Optional remote avatar; initials fallback is shown if missing or load fails */
  avatarUrl?: string;
  /** e.g. gemini://kennedy.gemi.dev — endpoint for this capsule’s Gemini backend */
  url?: string;
  /** Shown under the name on the capsule list when set */
  description?: string;
};
