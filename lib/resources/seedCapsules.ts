import type { Capsule } from "lib/models/capsule";

/** Demo rows used to seed SQLite on first launch (and v010 legacy demo replacement). */
export const SEED_CAPSULES: Capsule[] = [
  {
    id: "1",
    name: "Kennedy Search",
    url: "gemini://kennedy.gemi.dev",
    description: "Search through Gemini capsules",
  },
];
