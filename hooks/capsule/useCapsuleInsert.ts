import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "lib/queryKeys";
import { capsulesRepo, type CapsuleInsert } from "repositories";

export function useCapsuleInsert() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: CapsuleInsert) => capsulesRepo.insertCapsuleOnly(input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.capsules.all });
    },
  });
}
