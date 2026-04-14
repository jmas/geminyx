import { QueryClient } from "@tanstack/react-query";

/** Shared client for TanStack Query. Use {@link queryKeys} for stable cache keys. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
    },
  },
});
