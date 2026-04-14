import type { Capsule } from "lib/models/capsule";
import { normalizeGeminiCapsuleRootUrl } from "lib/models/gemini";

/**
 * Default capsule content for new accounts (no ids — capsule ids are unique per row).
 * `SEED_CAPSULES[0]` must remain Kennedy Search for migration v010.
 */
export const SEED_CAPSULE_TEMPLATES: Omit<Capsule, "id">[] = [
  {
    name: "Kennedy Search",
    url: "gemini://kennedy.gemi.dev",
    description: "Search through Gemini capsules",
  },
  {
    name: "Astrobotany",
    url: "gemini://astrobotany.mozz.us",
    description: "Text game where we grow own plant",
  },
  {
    name: "BBS GeminiSpace",
    url: "gemini://bbs.geminispace.org",
    description: "Social network or forum",
  },
];

/** Fixed ids for migration v010 (legacy five-capsule replacement). Runtime defaults use `SEED_CAPSULE_TEMPLATES`. */
export const SEED_CAPSULES: Capsule[] = SEED_CAPSULE_TEMPLATES.map((t, i) => ({
  id: String(i + 1),
  name: t.name,
  url: t.url ? normalizeGeminiCapsuleRootUrl(t.url) : undefined,
  description: t.description,
}));
