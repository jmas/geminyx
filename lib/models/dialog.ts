import type { Capsule } from "./capsule";

export type Dialog = {
  id: string;
  /** ISO 8601 timestamp of the last message in this dialog */
  lastMessageAt: string;
  capsule: Capsule;
  /**
   * Whether the user has approved sending the account-level client certificate
   * to this capsule/server (TLS client auth) at least once.
   */
  clientCertShareAllowed: boolean;
};
