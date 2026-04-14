import type { FormikHelpers } from "formik";
import { useState } from "react";
import {
  Alert,
  Modal,
  Platform,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from "react-native";
import {
  CapsuleForm,
  capsuleFormEmptyValues,
  type CapsuleFormModalPalette,
  type CapsuleFormValues,
} from "components/capsule/CapsuleForm";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import type { Capsule } from "lib/models/capsule";
import { accountsRepo, capsulesRepo } from "repositories";

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
  title = "Add Capsule",
}: CapsuleFormModalProps) {
  const scheme = useColorScheme();
  const palette: CapsuleFormModalPalette = selectCapsuleUiPalette(scheme);
  const [submitPending, setSubmitPending] = useState(false);

  function dismissCancelled() {
    onClose({ cancelled: true });
  }

  async function handleSubmit(
    values: CapsuleFormValues,
    { setSubmitting, resetForm }: FormikHelpers<CapsuleFormValues>,
  ) {
    setSubmitPending(true);
    try {
      const active = await accountsRepo.getActive();
      if (!active?.id) {
        Alert.alert("No account", "Select an account before adding a capsule.");
        return;
      }
      const created = await capsulesRepo.insertWithThread({
        accountId: active.id,
        name: values.name.trim(),
        avatarUrl: values.avatarUrl.trim() || undefined,
        url: values.url.trim() || undefined,
        description: values.description.trim() || undefined,
      });
      resetForm({ values: capsuleFormEmptyValues });
      onClose({ created });
    } catch (e) {
      console.error("createCapsule failed", e);
      Alert.alert(
        "Could not add capsule",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
      setSubmitPending(false);
      setSubmitting(false);
    }
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
          {title}
        </Text>
        <CapsuleForm
          palette={palette}
          scheme={scheme}
          isPending={submitPending}
          initialValues={capsuleFormEmptyValues}
          submitLabel="Add"
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
