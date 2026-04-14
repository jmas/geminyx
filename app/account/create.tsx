import { useInvalidate } from "@refinedev/core";
import { router } from "expo-router";
import { useCallback } from "react";
import { AccountCreateScreen } from "screens/account/AccountCreateScreen";
import { RESOURCES } from "lib/refineDataProvider";

export default function AccountCreateRoute() {
  const invalidate = useInvalidate();

  const onSuccess = useCallback(async () => {
    await invalidate({
      resource: RESOURCES.accounts,
      invalidates: ["list"],
    });
    await invalidate({
      resource: RESOURCES.capsules,
      invalidates: ["list"],
    });
    await invalidate({
      resource: RESOURCES.dialogs,
      invalidates: ["list"],
    });
    router.back();
  }, [invalidate]);

  return <AccountCreateScreen onSuccess={onSuccess} />;
}
