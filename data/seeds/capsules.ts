import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";

/**
 * Default category catalog for new accounts (Gemini “website” groupings).
 * Created when the account has no capsules yet, alongside seed capsules.
 */
export const SEED_CAPSULE_CATEGORIES: { name: string; sortOrder: number }[] = [
  { name: "Search & discovery", sortOrder: 0 },
  { name: "News & media", sortOrder: 1 },
  { name: "Games", sortOrder: 2 },
  { name: "Entertainment", sortOrder: 3 },
  { name: "Education & learning", sortOrder: 4 },
  { name: "Forums & community", sortOrder: 5 },
  { name: "Technology & development", sortOrder: 6 },
  { name: "Shopping & commerce", sortOrder: 7 },
  { name: "Personal & blogs", sortOrder: 8 },
  { name: "Art & design", sortOrder: 9 },
  { name: "Tools & utilities", sortOrder: 10 },
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
    avatarIcon: "🔭",
    url: "gemini://kennedy.gemi.dev",
    description: "Search through Gemini capsules",
    categoryName: "Search & discovery",
  },
  {
    name: "Astrobotany",
    avatarIcon: "🪴",
    url: "gemini://astrobotany.mozz.us",
    description: "A community gardening experience in geminispace",
    categoryName: "Games",
  },
  {
    name: "GeminiSpace BBS",
    avatarIcon: "💬",
    url: "gemini://bbs.geminispace.org",
    description: "Discussion forums, microblogging",
    categoryName: "Forums & community",
  },
  {
    name: "TildeTeam Community",
    avatarIcon: "🌐",
    url: "gemini://tilde.team",
    description:
      "A digital community for socializing, learning, and making cool stuff",
    categoryName: "Forums & community",
  },
  {
    name: "CAPCOM Feeds",
    avatarIcon: "📰",
    url: "gemini://gemini.circumlunar.space/capcom/",
    description:
      "A public aggregator of subscribable Gemini pages and Gemini Atom feeds",
    categoryName: "News & media",
  },
  {
    name: "GemiDev",
    avatarIcon: "🛠️",
    url: "gemini://gemi.dev",
    description:
      "Various services for Gemini like Gemipedia or Wayback machine",
    categoryName: "Tools & utilities",
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
