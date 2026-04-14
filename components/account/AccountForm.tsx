import type { TFunction } from "i18next";
import { Formik, type FormikHelpers } from "formik";
import { type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ColorValue,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as yup from "yup";
import { useKeyboardHeight } from "hooks/useKeyboardHeight";

export type AccountFormValues = {
  name: string;
  email: string;
  capsuleUrl: string;
};

export const accountFormEmptyValues: AccountFormValues = {
  name: "",
  email: "",
  capsuleUrl: "",
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

export function buildAccountFormValidationSchema(t: TFunction) {
  return yup.object({
    name: yup.string().trim().required(t("accountForm.validation.nameRequired")),
    email: yup
      .string()
      .trim()
      .test(
        "email",
        t("accountForm.validation.emailInvalid"),
        (v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
      ),
    capsuleUrl: yup
      .string()
      .trim()
      .test("url", t("accountForm.validation.urlInvalid"), isEmptyOrValidUrl),
  });
}

export type AccountFormPalette = {
  background: ColorValue;
  textPrimary: ColorValue;
  textSecondary: ColorValue;
  separator: ColorValue;
  fieldBg: ColorValue;
  fieldBorder: ColorValue;
  fieldText: ColorValue;
  placeholder: ColorValue;
  error: ColorValue;
  primaryLabel: ColorValue;
  primaryButtonBg: ColorValue;
};

export type AccountFormProps = {
  palette: AccountFormPalette;
  initialValues?: AccountFormValues;
  /** Optional helper text shown while submitting (e.g. generating cert). */
  submittingHint?: string;
  /** Disable inputs + button (e.g. parent doing critical work). */
  disabled?: boolean;
  /** Optional extra actions shown above the primary submit button. */
  footerExtra?: ReactNode;
  /** Use `useHeaderHeight()` when the form sits under a navigation header. */
  keyboardVerticalOffset?: number;
  submitLabel?: string;
  onSubmit: (
    values: AccountFormValues,
    helpers: FormikHelpers<AccountFormValues>,
  ) => void | Promise<void>;
};

export function AccountForm({
  palette,
  initialValues,
  submittingHint,
  disabled = false,
  footerExtra,
  submitLabel,
  onSubmit,
}: AccountFormProps) {
  const { t } = useTranslation();
  const resolvedSubmitLabel = submitLabel ?? t("accountForm.defaultSubmit");
  const validationSchema = useMemo(
    () => buildAccountFormValidationSchema(t),
    [t],
  );
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const footerBottomPad = Math.max(insets.bottom, 12);
  const footerLift = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0;

  return (
    <Formik<AccountFormValues>
      initialValues={initialValues ?? accountFormEmptyValues}
      enableReinitialize
      validationSchema={validationSchema}
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
      }) => {
        const isBusy = isSubmitting || disabled;
        return (
          <View style={styles.root}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[
                styles.scrollContent,
                {
                  // Footer is in normal layout flow (not overlaying the ScrollView),
                  // so extra bottom padding here creates a big visual gap above the button.
                  paddingBottom: 16,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <FieldBlock label={t("accountForm.displayName")} palette={palette}>
                <TextInput
                  value={values.name}
                  onChangeText={handleChange("name")}
                  onBlur={handleBlur("name")}
                  placeholder={t("accountForm.placeholderName")}
                  placeholderTextColor={palette.placeholder}
                  autoCorrect={false}
                  autoCapitalize="words"
                  editable={!isBusy}
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

              <FieldBlock label={t("accountForm.email")} palette={palette}>
                <TextInput
                  value={values.email}
                  onChangeText={handleChange("email")}
                  onBlur={handleBlur("email")}
                  placeholder={t("accountForm.placeholderEmailOptional")}
                  placeholderTextColor={palette.placeholder}
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  editable={!isBusy}
                  style={[
                    styles.fieldInput,
                    {
                      backgroundColor: palette.fieldBg,
                      borderColor: palette.fieldBorder,
                      color: palette.fieldText,
                    },
                  ]}
                />
                {touched.email && errors.email ? (
                  <Text style={[styles.fieldError, { color: palette.error }]}>
                    {errors.email}
                  </Text>
                ) : null}
              </FieldBlock>

              <FieldBlock label={t("accountForm.capsuleUrl")} palette={palette}>
                <TextInput
                  value={values.capsuleUrl}
                  onChangeText={handleChange("capsuleUrl")}
                  onBlur={handleBlur("capsuleUrl")}
                  placeholder={t("accountForm.placeholderCapsuleUrl")}
                  placeholderTextColor={palette.placeholder}
                  autoCorrect={false}
                  autoCapitalize="none"
                  keyboardType="url"
                  editable={!isBusy}
                  style={[
                    styles.fieldInput,
                    {
                      backgroundColor: palette.fieldBg,
                      borderColor: palette.fieldBorder,
                      color: palette.fieldText,
                    },
                  ]}
                />
                {touched.capsuleUrl && errors.capsuleUrl ? (
                  <Text style={[styles.fieldError, { color: palette.error }]}>
                    {errors.capsuleUrl}
                  </Text>
                ) : null}
              </FieldBlock>
            </ScrollView>

            <View
              style={[
                styles.footer,
                {
                  backgroundColor: palette.background,
                  paddingBottom: footerBottomPad,
                  marginBottom: footerLift,
                },
              ]}
            >
              {isBusy && submittingHint ? (
                <Text
                  style={[
                    styles.submittingHint,
                    { color: palette.textSecondary },
                  ]}
                >
                  {submittingHint}
                </Text>
              ) : null}
              {footerExtra ? (
                <View style={styles.footerExtra}>
                  {footerExtra}
                </View>
              ) : null}
              <Pressable
                onPress={() => handleSubmit()}
                disabled={isBusy}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  {
                    backgroundColor: palette.primaryButtonBg,
                    opacity: isBusy ? 0.7 : 1,
                  },
                  pressed && !isBusy && { opacity: 0.88 },
                ]}
              >
                {isBusy ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text
                    style={[
                      styles.primaryLabel,
                      { color: palette.primaryLabel },
                    ]}
                  >
                    {resolvedSubmitLabel}
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        );
      }}
    </Formik>
  );
}

function FieldBlock({
  label,
  palette,
  children,
}: {
  label: string;
  palette: AccountFormPalette;
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
  root: {
    gap: 12,
    flex: 1,
  },
  scroll: {},
  scrollContent: {},
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
  fieldError: {
    fontSize: 13,
    marginTop: 6,
  },
  footer: {},
  footerExtra: {
    marginBottom: 10,
    gap: 10,
  },
  submittingHint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  primaryBtn: {
    minHeight: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});
