import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";
import i18n from "lib/i18n/init";

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

type SeedCategoryKey =
  | "searchDiscovery"
  | "newsMedia"
  | "games"
  | "entertainment"
  | "educationLearning"
  | "forumsCommunity"
  | "technologyDevelopment"
  | "shoppingCommerce"
  | "personalBlogs"
  | "artDesign"
  | "toolsUtilities";

function seedCategoryName(key: SeedCategoryKey): string {
  return i18n.t(`seeds.categories.${key}`);
}

/**
 * Localized default category catalog for new accounts (uses current i18n language,
 * which defaults to system language).
 *
 * Note: category names are stored in the DB as plain strings at seed time.
 */
export function seedCapsuleCategories(): { name: string; sortOrder: number }[] {
  return [
    { name: seedCategoryName("searchDiscovery"), sortOrder: 0 },
    { name: seedCategoryName("newsMedia"), sortOrder: 1 },
    { name: seedCategoryName("games"), sortOrder: 2 },
    { name: seedCategoryName("entertainment"), sortOrder: 3 },
    { name: seedCategoryName("educationLearning"), sortOrder: 4 },
    { name: seedCategoryName("forumsCommunity"), sortOrder: 5 },
    { name: seedCategoryName("technologyDevelopment"), sortOrder: 6 },
    { name: seedCategoryName("shoppingCommerce"), sortOrder: 7 },
    { name: seedCategoryName("personalBlogs"), sortOrder: 8 },
    { name: seedCategoryName("artDesign"), sortOrder: 9 },
    { name: seedCategoryName("toolsUtilities"), sortOrder: 10 },
  ];
}

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
    name: "IIch",
    avatarIcon: "♊",
    url: "gemini://iich.space",
    description: "A simple text-based bulletin board modeled after 2ch",
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
  {
    name: "My Gemini Space",
    avatarIcon: "📝",
    url: "gemini://mygemini.space",
    description:
      "A public gemini hosting service that uses a web front-end for content authoring",
    categoryName: "Tools & utilities",
  },
  {
    name: "Project Gemini",
    avatarIcon: "ℹ️",
    url: "gemini://geminiprotocol.net",
    description: "Gemini in 100 words",
    categoryName: "Education & learning",
  },
];

/**
 * Localized default capsule templates for new accounts (uses current i18n language,
 * which defaults to system language).
 */
export function seedCapsuleTemplates(): SeedCapsuleTemplate[] {
  return [
    {
      name: i18n.t("seeds.capsules.kennedySearch.name"),
      avatarIcon: "🔭",
      url: "gemini://kennedy.gemi.dev",
      description: i18n.t("seeds.capsules.kennedySearch.description"),
      categoryName: seedCategoryName("searchDiscovery"),
    },
    {
      name: "Astrobotany",
      avatarIcon: "🪴",
      url: "gemini://astrobotany.mozz.us",
      description: i18n.t("seeds.capsules.astrobotany.description"),
      categoryName: seedCategoryName("games"),
    },
    {
      name: "GeminiSpace BBS",
      avatarIcon: "💬",
      url: "gemini://bbs.geminispace.org",
      description: i18n.t("seeds.capsules.geminiSpaceBbs.description"),
      categoryName: seedCategoryName("forumsCommunity"),
    },
    {
      name: "TildeTeam Community",
      avatarIcon: "🌐",
      url: "gemini://tilde.team",
      description: i18n.t("seeds.capsules.tildeTeam.description"),
      categoryName: seedCategoryName("forumsCommunity"),
    },
    {
      name: "IIch",
      avatarIcon: "♊",
      url: "gemini://iich.space",
      description: i18n.t("seeds.capsules.iich.description"),
      categoryName: seedCategoryName("forumsCommunity"),
    },
    {
      name: "CAPCOM Feeds",
      avatarIcon: "📰",
      url: "gemini://gemini.circumlunar.space/capcom/",
      description: i18n.t("seeds.capsules.capcomFeeds.description"),
      categoryName: seedCategoryName("newsMedia"),
    },
    {
      name: "GemiDev",
      avatarIcon: "🛠️",
      url: "gemini://gemi.dev",
      description: i18n.t("seeds.capsules.gemiDev.description"),
      categoryName: seedCategoryName("toolsUtilities"),
    },
    {
      name: "My Gemini Space",
      avatarIcon: "📝",
      url: "gemini://mygemini.space",
      description: i18n.t("seeds.capsules.myGeminiSpace.description"),
      categoryName: seedCategoryName("toolsUtilities"),
    },
    {
      name: "Project Gemini",
      avatarIcon: "ℹ️",
      url: "gemini://geminiprotocol.net",
      description: i18n.t("seeds.capsules.projectGemini.description"),
      categoryName: seedCategoryName("educationLearning"),
    },
  ];
}

/** Fixed ids for migration v010 (legacy five-capsule replacement). Runtime defaults use `SEED_CAPSULE_TEMPLATES`. */
export const SEED_CAPSULES: Capsule[] = SEED_CAPSULE_TEMPLATES.map((t, i) => ({
  id: String(i + 1),
  name: t.name,
  avatarIcon: t.avatarIcon,
  url: t.url ? normalizeGeminiCapsuleRootUrl(t.url) : undefined,
  description: t.description,
}));
