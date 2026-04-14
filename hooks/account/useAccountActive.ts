import { useFocusEffect } from "@react-navigation/native";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { useCallback } from "react";
import type { Account } from "lib/models/account";
import { queryKeys } from "lib/queryKeys";
import { accountsRepo } from "repositories";

type UseAccountActiveOptions = {
  /** When true (default), refetch when the screen gains focus. */
  refetchOnFocus?: boolean;
};

export function useAccountActive(
  options?: UseAccountActiveOptions,
): UseQueryResult<Account | null, Error> {
  const refetchOnFocus = options?.refetchOnFocus ?? true;
  const query = useQuery({
    queryKey: queryKeys.accounts.active(),
    queryFn: () => accountsRepo.getActive(),
  });
  const { refetch } = query;

  useFocusEffect(
    useCallback(() => {
      if (refetchOnFocus) void refetch();
    }, [refetchOnFocus, refetch]),
  );

  return query;
}
