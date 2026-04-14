/** Centralized TanStack Query keys — import these instead of string literals. */
export const queryKeys = {
  settings: {
    all: ["settings"] as const,
    uiLanguage: () => [...queryKeys.settings.all, "ui-language"] as const,
  },
  accounts: {
    all: ["accounts"] as const,
    active: () => [...queryKeys.accounts.all, "active"] as const,
    list: () => [...queryKeys.accounts.all, "list"] as const,
  },
  capsules: {
    all: ["capsules"] as const,
    listForActive: () => [...queryKeys.capsules.all, "list-for-active"] as const,
    detail: (capsuleId: string) =>
      [...queryKeys.capsules.all, "detail", capsuleId] as const,
  },
  categories: {
    all: ["categories"] as const,
    listForActive: () =>
      [...queryKeys.categories.all, "list-for-active"] as const,
  },
  threads: {
    all: ["threads"] as const,
    listForActive: () => [...queryKeys.threads.all, "list-for-active"] as const,
    detail: (threadId: string) =>
      [...queryKeys.threads.all, "detail", threadId] as const,
  },
} as const;
