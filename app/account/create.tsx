import { router } from "expo-router";
import { AccountCreateScreen } from "screens/account/AccountCreateScreen";

export default function AccountCreateRoute() {
  const onSuccess = () => {
    router.back();
  };

  return <AccountCreateScreen onSuccess={onSuccess} />;
}
