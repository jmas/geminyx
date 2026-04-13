export type Account = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  /** Endpoint for this account’s capsule / backend */
  capsuleUrl?: string;
  /** True for the account currently selected in the app (only one at a time) */
  isActive: boolean;
};
