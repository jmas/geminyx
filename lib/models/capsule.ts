export type Capsule = {
  id: string;
  name: string;
  /** Optional emoji shown in the avatar circle instead of initials */
  avatarIcon?: string;
  /** e.g. gemini://kennedy.gemi.dev — endpoint for this capsule’s Gemini backend */
  url?: string;
  /** Shown under the name on the capsule list when set */
  description?: string;
  /** When unset, the capsule appears under the default “General” group */
  categoryId?: string;
};
