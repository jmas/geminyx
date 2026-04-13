import { Formik, type FormikHelpers } from "formik";
import { type ReactNode } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as yup from "yup";
import { systemBlueForScheme } from "lib/theme/appColors";

export type CapsuleFormValues = {
  name: string;
  avatarUrl: string;
  url: string;
  description: string;
};

export const capsuleFormEmptyValues: CapsuleFormValues = {
  name: "",
  avatarUrl: "",
  url: "",
  description: "",
};

function isEmptyOrValidUrl(value: string | undefined) {
  const v = (value ?? "").trim();
  if (!v) return true;
  try {
    new URL(v);
    return true;
  } catch {
    return false;
  }
}

export const capsuleFormValidationSchema = yup.object({
  name: yup.string().trim().required("Name is required"),
  avatarUrl: yup
    .string()
    .trim()
    .test("url", "Must be a valid URL", isEmptyOrValidUrl),
  url: yup
    .string()
    .trim()
    .test("url", "Must be a valid URL", isEmptyOrValidUrl),
  description: yup
    .string()
    .trim()
    .max(500, "Description must be at most 500 characters"),
});

export type CapsuleFormPalette = {
  background: string;
  textSecondary: string;
  separator: string;
  fieldBg: string;
  fieldBorder: string;
  fieldText: string;
  placeholder: string;
  error: string;
  cancelLabel: string;
  addLabel: string;
};

export type CapsuleFormModalPalette = CapsuleFormPalette & {
  sheetTitle: string;
  sheetHandle: string;
};

export type CapsuleFormProps = {
  palette: CapsuleFormPalette;
  scheme: "light" | "dark" | null | undefined;
  isPending: boolean;
  onCancel: () => void;
  onSubmit: (
    values: CapsuleFormValues,
    helpers: FormikHelpers<CapsuleFormValues>,
  ) => void | Promise<void>;
};

export function CapsuleForm({
  palette,
  scheme,
  isPending,
  onCancel,
  onSubmit,
}: CapsuleFormProps) {
  const insets = useSafeAreaInsets();
  const submitSpinnerColor = systemBlueForScheme(scheme);

  return (
    <Formik<CapsuleFormValues>
      initialValues={capsuleFormEmptyValues}
      validationSchema={capsuleFormValidationSchema}
      onSubmit={onSubmit}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        handleSubmit,
        isSubmitting,
      }) => (
        <>
          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="interactive"
          >
            <FieldBlock label="Name" palette={palette}>
              <TextInput
                value={values.name}
                onChangeText={handleChange("name")}
                onBlur={handleBlur("name")}
                placeholder="Display name"
                placeholderTextColor={palette.placeholder}
                autoCorrect={false}
                autoCapitalize="words"
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: palette.fieldBg,
                    borderColor: palette.fieldBorder,
                    color: palette.fieldText,
                  },
                ]}
              />
              {touched.name && errors.name ? (
                <Text style={[styles.fieldError, { color: palette.error }]}>
                  {errors.name}
                </Text>
              ) : null}
            </FieldBlock>

            <FieldBlock label="Avatar URL" palette={palette}>
              <TextInput
                value={values.avatarUrl}
                onChangeText={handleChange("avatarUrl")}
                onBlur={handleBlur("avatarUrl")}
                placeholder="https://…"
                placeholderTextColor={palette.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: palette.fieldBg,
                    borderColor: palette.fieldBorder,
                    color: palette.fieldText,
                  },
                ]}
              />
              {touched.avatarUrl && errors.avatarUrl ? (
                <Text style={[styles.fieldError, { color: palette.error }]}>
                  {errors.avatarUrl}
                </Text>
              ) : null}
            </FieldBlock>

            <FieldBlock label="Capsule URL" palette={palette}>
              <TextInput
                value={values.url}
                onChangeText={handleChange("url")}
                onBlur={handleBlur("url")}
                placeholder="gemini://…"
                placeholderTextColor={palette.placeholder}
                autoCorrect={false}
                autoCapitalize="none"
                keyboardType="url"
                style={[
                  styles.fieldInput,
                  {
                    backgroundColor: palette.fieldBg,
                    borderColor: palette.fieldBorder,
                    color: palette.fieldText,
                  },
                ]}
              />
              {touched.url && errors.url ? (
                <Text style={[styles.fieldError, { color: palette.error }]}>
                  {errors.url}
                </Text>
              ) : null}
            </FieldBlock>

            <FieldBlock label="Description" palette={palette}>
              <TextInput
                value={values.description}
                onChangeText={handleChange("description")}
                onBlur={handleBlur("description")}
                placeholder="Optional subtitle"
                placeholderTextColor={palette.placeholder}
                multiline
                style={[
                  styles.fieldInput,
                  styles.fieldInputMultiline,
                  {
                    backgroundColor: palette.fieldBg,
                    borderColor: palette.fieldBorder,
                    color: palette.fieldText,
                  },
                ]}
              />
              {touched.description && errors.description ? (
                <Text style={[styles.fieldError, { color: palette.error }]}>
                  {errors.description}
                </Text>
              ) : null}
            </FieldBlock>
          </ScrollView>

          <View
            style={[
              styles.actions,
              {
                borderTopColor: palette.separator,
                paddingBottom: Math.max(insets.bottom, 12),
                backgroundColor: palette.background,
              },
            ]}
          >
            <Pressable
              onPress={onCancel}
              disabled={isSubmitting || isPending}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityLabel="Cancel"
            >
              <Text
                style={[styles.actionLabel, { color: palette.cancelLabel }]}
              >
                Cancel
              </Text>
            </Pressable>
            <Pressable
              onPress={() => handleSubmit()}
              disabled={isSubmitting || isPending}
              style={({ pressed }) => [
                styles.actionBtn,
                pressed && { opacity: 0.55 },
              ]}
              accessibilityLabel="Add capsule"
            >
              {isSubmitting || isPending ? (
                <ActivityIndicator color={submitSpinnerColor} />
              ) : (
                <Text
                  style={[
                    styles.actionLabel,
                    {
                      color: palette.addLabel,
                      fontWeight: "600",
                    },
                  ]}
                >
                  Add
                </Text>
              )}
            </Pressable>
          </View>
        </>
      )}
    </Formik>
  );
}

function FieldBlock({
  label,
  palette,
  children,
}: {
  label: string;
  palette: CapsuleFormPalette;
  children: ReactNode;
}) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={[styles.fieldLabel, { color: palette.textSecondary }]}>
        {label}
      </Text>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  fieldBlock: {
    marginTop: 14,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 6,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 16,
  },
  fieldInputMultiline: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  fieldError: {
    fontSize: 13,
    marginTop: 6,
  },
  actions: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actionBtn: {
    minWidth: 80,
    minHeight: 44,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    fontSize: 17,
  },
});
