import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";

/**
 * Default category catalog for new accounts (Gemini “website” groupings).
 * Created when the account has no capsules yet, alongside seed capsules.
 */
export const SEED_CAPSULE_CATEGORIES: { name: string; sortOrder: number }[] = [
  { name: "Search & discovery", sortOrder: 0 },
  { name: "Games", sortOrder: 1 },
  { name: "Forums & community", sortOrder: 2 },
];

export type SeedCapsuleTemplate = Omit<Capsule, "id"> & {
  /** Must match `name` in `SEED_CAPSULE_CATEGORIES` when set. */
  categoryName?: string;
};

/**
 * Default capsule content for new accounts (no ids — capsule ids are unique per row).
 * `SEED_CAPSULES[0]` must remain Kennedy Search for migration v010.
 */
export const SEED_CAPSULE_TEMPLATES: SeedCapsuleTemplate[] = [
  {
    name: "Kennedy Search",
    avatarIcon: "🔍",
    url: "gemini://kennedy.gemi.dev",
    description: "Search through Gemini capsules",
    categoryName: "Search & discovery",
  },
  {
    name: "Astrobotany",
    avatarIcon: "🪴",
    url: "gemini://astrobotany.mozz.us",
    description: "Text game where we grow own plant",
    categoryName: "Games",
  },
  {
    name: "BBS GeminiSpace",
    avatarIcon: "💬",
    url: "gemini://bbs.geminispace.org",
    description: "Social network or forum",
    categoryName: "Forums & community",
  },
];

/** Fixed ids for migration v010 (legacy five-capsule replacement). Runtime defaults use `SEED_CAPSULE_TEMPLATES`. */
export const SEED_CAPSULES: Capsule[] = SEED_CAPSULE_TEMPLATES.map((t, i) => ({
  id: String(i + 1),
  name: t.name,
  avatarIcon: t.avatarIcon,
  url: t.url ? normalizeGeminiCapsuleRootUrl(t.url) : undefined,
  description: t.description,
}));
