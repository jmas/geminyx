import type { Capsule } from "./capsule";

export type Dialog = {
  id: string;
  /** ISO 8601 timestamp of the last message in this dialog */
  lastMessageAt: string;
  capsule: Capsule;
};
