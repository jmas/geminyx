import type { CapsulePatch } from "repositories/capsuleRepository";

export const RESOURCE = "capsules" as const;

export type { Capsule } from "lib/models/capsule";

export type CapsuleCreateVariables = {
  name: string;
  avatarIcon?: string;
  url?: string;
  description?: string;
};

export type CapsuleUpdateVariables = CapsulePatch;

export {
  SEED_CAPSULES,
  SEED_CAPSULE_CATEGORIES,
  SEED_CAPSULE_TEMPLATES,
} from "lib/resources/seedCapsules";
export type { SeedCapsuleTemplate } from "lib/resources/seedCapsules";
