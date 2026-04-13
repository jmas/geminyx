import { useCreate, useInvalidate } from "@refinedev/core";
import type { FormikHelpers } from "formik";
import {
  Alert,
  KeyboardAvoidingView,
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
import { RESOURCES } from "lib/refineDataProvider";

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

  const invalidate = useInvalidate();
  const { mutateAsync: createCapsule, mutation: createMutation } = useCreate({
    resource: RESOURCES.capsules,
    mutationOptions: {
      onSuccess: async () => {
        await invalidate({ resource: RESOURCES.capsules, invalidates: ["list"] });
        await invalidate({ resource: RESOURCES.dialogs, invalidates: ["list"] });
      },
    },
  });

  function dismissCancelled() {
    onClose({ cancelled: true });
  }

  async function handleSubmit(
    values: CapsuleFormValues,
    { setSubmitting, resetForm }: FormikHelpers<CapsuleFormValues>,
  ) {
    try {
      const { data: capsule } = await createCapsule({
        values: {
          name: values.name.trim(),
          avatarUrl: values.avatarUrl.trim() || undefined,
          url: values.url.trim() || undefined,
          description: values.description.trim() || undefined,
        },
      });
      const created = capsule as Capsule;
      resetForm({ values: capsuleFormEmptyValues });
      onClose({ created });
    } catch (e) {
      console.error("createCapsule failed", e);
      Alert.alert(
        "Could not add capsule",
        e instanceof Error ? e.message : String(e),
      );
    } finally {
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
      <KeyboardAvoidingView
        style={[styles.root, { backgroundColor: palette.background }]}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
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
          isPending={createMutation.isPending}
          onCancel={dismissCancelled}
          onSubmit={handleSubmit}
        />
      </KeyboardAvoidingView>
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
