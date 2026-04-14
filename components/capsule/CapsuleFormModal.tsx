import {
  CapsuleForm,
  capsuleFormEmptyValues,
  type CapsuleFormModalPalette,
  type CapsuleFormValues,
} from "components/capsule/CapsuleForm";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { useQuery } from "@tanstack/react-query";
import type { FormikHelpers } from "formik";
import { useAccountActive } from "hooks/account/useAccountActive";
import { useCapsuleInsert } from "hooks/capsule/useCapsuleInsert";
import type { Capsule } from "lib/models/capsule";
import { queryKeys } from "lib/queryKeys";
import { categoriesRepo } from "repositories";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import { alertError } from "utils/error";

export type { CapsuleFormModalPalette } from "components/capsule/CapsuleForm";

export type CapsuleFormModalCloseResult =
  | { cancelled: true }
  | { created: Capsule };

export type CapsuleFormModalProps = {
  /** Injected by react-popup-manager */
  isOpen: boolean;
  /** Injected by react-popup-manager */
  onClose: (result?: CapsuleFormModalCloseResult) => void;
  title?: string;
};

export function CapsuleFormModal({
  isOpen,
  onClose,
  title,
}: CapsuleFormModalProps) {
  const { t } = useTranslation();
  const resolvedTitle = title ?? t("capsules.modalAddTitle");
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const { data: activeAccount } = useAccountActive();
  const insertMutation = useCapsuleInsert();

  const { data: categories = [], isPending: categoriesPending } = useQuery({
    queryKey: [
      ...queryKeys.categories.listForActive(),
      activeAccount?.id ?? "none",
    ],
    queryFn: async () => {
      if (!activeAccount?.id) return [];
      return categoriesRepo.listOrdered(activeAccount.id);
    },
    enabled: isOpen && Boolean(activeAccount?.id),
  });

  const categoryOptions = useMemo(
    () => [
      ...categories.map((c) => ({ id: c.id, name: c.name })),
      { id: "", name: t("capsules.sectionGeneral") },
    ],
    [categories, t],
  );

  function dismissCancelled() {
    onClose({ cancelled: true });
  }

  function handleSubmit(
    values: CapsuleFormValues,
    { setSubmitting, resetForm }: FormikHelpers<CapsuleFormValues>,
  ) {
    if (!activeAccount?.id) {
      Alert.alert(
        t("capsules.noAccountTitle"),
        t("capsules.addNoAccountBody"),
      );
      setSubmitting(false);
      return;
    }
    return new Promise<void>((resolve, reject) => {
      insertMutation.mutate(
        {
          accountId: activeAccount.id,
          name: values.name.trim(),
          avatarIcon: values.avatarIcon.trim() || undefined,
          url: values.url.trim() || undefined,
          description: values.description.trim() || undefined,
          categoryId: values.categoryId.trim() || undefined,
        },
        {
          onSuccess: (created) => {
            resetForm({ values: capsuleFormEmptyValues });
            onClose({ created });
            resolve();
          },
          onError: (e) => {
            console.error("createCapsule failed", e);
            alertError(e, t("capsules.addCapsuleError"), t("capsules.addCapsuleErrorTitle"));
            reject(e);
          },
        },
      );
    });
  }

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={dismissCancelled}
    >
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={styles.grabberWrap}>
          <View
            style={[styles.grabber, { backgroundColor: palette.sheetHandle }]}
          />
        </View>
        <Text style={[styles.title, { color: palette.sheetTitle }]}>
          {resolvedTitle}
        </Text>
        <CapsuleForm
          palette={palette}
          scheme={scheme}
          isPending={insertMutation.isPending}
          initialValues={capsuleFormEmptyValues}
          categoryOptions={categoryOptions}
          categoryOptionsLoading={categoriesPending}
          onCancel={dismissCancelled}
          onSubmit={handleSubmit}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  grabberWrap: {
    alignItems: "center",
    paddingTop: 8,
    paddingBottom: 4,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 3,
  },
  title: {
    fontSize: 20,
    fontWeight: "700",
    textAlign: "center",
    marginBottom: 8,
  },
});
