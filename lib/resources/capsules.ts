import type { CapsulePatch } from "repositories/capsuleRepository";

export const RESOURCE = "capsules" as const;

export type { Capsule } from "lib/models/capsule";

export type CapsuleCreateVariables = {
  name: string;
  avatarUrl?: string;
  url?: string;
  description?: string;
};

export type CapsuleUpdateVariables = CapsulePatch;

export { SEED_CAPSULES } from "lib/resources/seedCapsules";
