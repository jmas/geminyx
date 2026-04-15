import { Ionicons } from "@expo/vector-icons";
import { Formik, type FormikHelpers } from "formik";
import { type ReactNode, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
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
import EmojiPicker, { type EmojiType } from "rn-emoji-keyboard";
import type { TFunction } from "i18next";
import * as yup from "yup";
import { useTranslation } from "react-i18next";
import { rnEmojiKeyboardTheme } from "components/capsule/capsuleEmojiKeyboardTheme";
import { useKeyboardHeight } from "hooks/useKeyboardHeight";
import { useCurrentLang } from "hooks/useCurrentLang";
import { emojiKeyboardTranslation } from "lib/i18n";
import { suggestedCapsuleNameFromGeminiUrl } from "lib/models/gemini";
import { modalBackdropScrim } from "lib/theme/semanticUi";

export type CapsuleFormValues = {
  name: string;
  /** Emoji string; empty means use initials in the avatar circle */
  avatarIcon: string;
  url: string;
  description: string;
  /** Empty string means the default “General” (uncategorized). */
  categoryId: string;
};

export const capsuleFormEmptyValues: CapsuleFormValues = {
  name: "",
  avatarIcon: "",
  url: "",
  description: "",
  categoryId: "",
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

export function buildCapsuleFormValidationSchema(t: TFunction) {
  return yup.object({
    name: yup.string().trim().required(t("capsuleForm.validation.nameRequired")),
    avatarIcon: yup
      .string()
      .trim()
      .max(32, t("capsuleForm.validation.iconTooLong")),
    url: yup
      .string()
      .trim()
      .test("url", t("capsuleForm.validation.urlInvalid"), isEmptyOrValidUrl),
    description: yup
      .string()
      .trim()
      .max(500, t("capsuleForm.validation.descriptionMax")),
    categoryId: yup.string(),
  });
}

export type CapsuleFormPalette = {
  background: ColorValue;
  textSecondary: ColorValue;
  separator: ColorValue;
  fieldBg: ColorValue;
  fieldBorder: ColorValue;
  fieldText: ColorValue;
  placeholder: ColorValue;
  error: ColorValue;
  cancelLabel: ColorValue;
  addLabel: ColorValue;
};

export type CapsuleFormModalPalette = CapsuleFormPalette & {
  sheetTitle: ColorValue;
  sheetHandle: ColorValue;
};

export type CategoryOption = { id: string; name: string };

export type CapsuleFormProps = {
  palette: CapsuleFormPalette;
  scheme: "light" | "dark" | null | undefined;
  isPending: boolean;
  initialValues?: CapsuleFormValues;
  submitLabel?: string;
  /** When true, changing Capsule URL updates the name from the hostname (add flow). */
  autoNameFromUrl?: boolean;
  /** Use `useHeaderHeight()` when the form sits under a navigation header. */
  keyboardVerticalOffset?: number;
  /** When set, shows a category picker (includes “General” as `id: ""`, last). */
  categoryOptions?: CategoryOption[];
  categoryOptionsLoading?: boolean;
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
  initialValues = capsuleFormEmptyValues,
  submitLabel,
  autoNameFromUrl = true,
  categoryOptions,
  categoryOptionsLoading,
  onCancel,
  onSubmit,
}: CapsuleFormProps) {
  const { t } = useTranslation();
  const lang = useCurrentLang();
  const resolvedSubmitLabel = submitLabel ?? t("common.add");
  const validationSchema = useMemo(
    () => buildCapsuleFormValidationSchema(t),
    [t],
  );
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const bottomPad = Math.max(insets.bottom, 12);
  const footerLift = keyboardHeight > 0 ? Math.max(0, keyboardHeight - insets.bottom) : 0;
  const scrollBottomPad =
    16 + styles.actions.paddingTop + ACTION_ROW_HEIGHT + bottomPad;
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  return (
    <Formik<CapsuleFormValues>
      enableReinitialize
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}
    >
      {({
        values,
        errors,
        touched,
        handleChange,
        handleBlur,
        setFieldValue,
        handleSubmit,
        isSubmitting,
      }) => {
        const selectedCategoryName =
          categoryOptions?.find((o) => o.id === (values.categoryId ?? ""))
            ?.name ?? t("capsules.sectionGeneral");

        const trimmedIcon = values.avatarIcon.trim();

        const onUrlChange = (text: string) => {
          void setFieldValue("url", text);
          if (!autoNameFromUrl) return;
          const trimmed = text.trim();
          if (!trimmed) return;
          try {
            new URL(trimmed);
            void setFieldValue("name", suggestedCapsuleNameFromGeminiUrl(trimmed));
          } catch {
            /* invalid URL — keep name */
          }
        };

        return (
          <View style={styles.root}>
            <ScrollView
              style={styles.scroll}
              contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
            >
              <FieldBlock label={t("capsuleForm.capsuleUrl")} palette={palette}>
                <TextInput
                  value={values.url}
                  onChangeText={onUrlChange}
                  onBlur={handleBlur("url")}
                  placeholder={t("capsuleForm.placeholderUrl")}
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

              <FieldBlock label={t("capsuleForm.name")} palette={palette}>
                <TextInput
                  value={values.name}
                  onChangeText={handleChange("name")}
                  onBlur={handleBlur("name")}
                  placeholder={t("capsuleForm.placeholderName")}
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

              <FieldBlock label={t("capsuleForm.icon")} palette={palette}>
                <View
                  style={[
                    styles.fieldInput,
                    styles.categoryPickerRow,
                    {
                      backgroundColor: palette.fieldBg,
                      borderColor: palette.fieldBorder,
                    },
                  ]}
                >
                  <TextInput
                    value={values.avatarIcon}
                    onChangeText={handleChange("avatarIcon")}
                    onBlur={handleBlur("avatarIcon")}
                    placeholder={t("capsuleForm.placeholderIcon")}
                    placeholderTextColor={palette.placeholder}
                    maxLength={32}
                    editable={!isPending}
                    autoCorrect={false}
                    style={[
                      styles.iconFieldInput,
                      {
                        color: palette.fieldText,
                        backgroundColor: "transparent",
                      },
                      Platform.OS === "android" ? { includeFontPadding: false } : null,
                    ]}
                  />
                  <View style={styles.iconFieldActions}>
                    {trimmedIcon ? (
                      <Pressable
                        onPress={() => void setFieldValue("avatarIcon", "")}
                        disabled={isPending}
                        hitSlop={8}
                        style={({ pressed }) => [
                          styles.iconFieldTrailingBtn,
                          pressed && { opacity: 0.55 },
                        ]}
                        accessibilityLabel={t("capsuleForm.a11yClearIcon")}
                      >
                        <Ionicons
                          name="close-circle"
                          size={20}
                          color={palette.textSecondary as string}
                        />
                      </Pressable>
                    ) : null}
                    <Pressable
                      onPress={() => setEmojiPickerOpen(true)}
                      disabled={isPending}
                      hitSlop={8}
                      style={({ pressed }) => [
                        styles.iconFieldTrailingBtn,
                        pressed && { opacity: 0.55 },
                      ]}
                      accessibilityLabel={t("capsuleForm.a11yOpenEmoji")}
                      accessibilityHint={t("capsuleForm.a11yEmojiHint")}
                    >
                      <Ionicons
                        name="happy-outline"
                        size={20}
                        color={palette.addLabel as string}
                      />
                    </Pressable>
                  </View>
                </View>
                {touched.avatarIcon && errors.avatarIcon ? (
                  <Text style={[styles.fieldError, { color: palette.error }]}>
                    {errors.avatarIcon}
                  </Text>
                ) : null}
              </FieldBlock>

              {categoryOptions ? (
                <FieldBlock label={t("capsuleForm.category")} palette={palette}>
                  <Pressable
                    onPress={() => setCategoryPickerOpen(true)}
                    disabled={categoryOptionsLoading || isPending}
                    style={({ pressed }) => [
                      styles.fieldInput,
                      styles.categoryPickerRow,
                      {
                        backgroundColor: palette.fieldBg,
                        borderColor: palette.fieldBorder,
                      },
                      pressed && { opacity: 0.75 },
                    ]}
                    accessibilityLabel={t("capsuleForm.a11yChooseCategory")}
                  >
                    <Text
                      style={[styles.categoryPickerText, { color: palette.fieldText }]}
                      numberOfLines={1}
                    >
                      {categoryOptionsLoading ? t("common.loading") : selectedCategoryName}
                    </Text>
                    <Ionicons
                      name="chevron-down"
                      size={20}
                      color={palette.textSecondary as string}
                    />
                  </Pressable>
                  <Modal
                    visible={categoryPickerOpen}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setCategoryPickerOpen(false)}
                  >
                    <View style={styles.catModalRoot}>
                      <Pressable
                        style={styles.catModalBackdrop}
                        onPress={() => setCategoryPickerOpen(false)}
                      />
                      <View
                        style={[
                          styles.catModalSheet,
                          {
                            backgroundColor: palette.fieldBg,
                            borderColor: palette.fieldBorder,
                            marginBottom: insets.bottom + 12,
                          },
                        ]}
                      >
                        <Text
                          style={[styles.catModalTitle, { color: palette.fieldText }]}
                          accessibilityRole="header"
                        >
                          {t("capsuleForm.modalCategoryTitle")}
                        </Text>
                        <FlatList
                          data={categoryOptions}
                          keyExtractor={(item) => item.id || "__general__"}
                          keyboardShouldPersistTaps="handled"
                          style={styles.catModalList}
                          renderItem={({ item }) => (
                            <Pressable
                              onPress={() => {
                                void setFieldValue("categoryId", item.id);
                                setCategoryPickerOpen(false);
                              }}
                              style={({ pressed }) => [
                                styles.catModalRow,
                                pressed && { opacity: 0.7 },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.catModalRowLabel,
                                  { color: palette.fieldText },
                                ]}
                                numberOfLines={2}
                              >
                                {item.name}
                              </Text>
                              {(values.categoryId ?? "") === item.id ? (
                                <Ionicons
                                  name="checkmark"
                                  size={22}
                                  color={palette.addLabel as string}
                                />
                              ) : null}
                            </Pressable>
                          )}
                        />
                        <View
                          style={[
                            styles.catModalFooter,
                            { borderTopColor: palette.separator },
                          ]}
                        >
                          <Pressable
                            onPress={() => setCategoryPickerOpen(false)}
                            style={({ pressed }) => [
                              styles.catModalDoneBtn,
                              pressed && { opacity: 0.55 },
                            ]}
                            accessibilityRole="button"
                            accessibilityLabel={t("capsuleForm.a11yDone")}
                          >
                            <Text
                              style={[
                                styles.catModalDoneLabel,
                                { color: palette.cancelLabel },
                              ]}
                            >
                              {t("common.done")}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    </View>
                  </Modal>
                </FieldBlock>
              ) : null}

              <FieldBlock label={t("capsuleForm.description")} palette={palette}>
                <TextInput
                  value={values.description}
                  onChangeText={handleChange("description")}
                  onBlur={handleBlur("description")}
                  placeholder={t("capsuleForm.placeholderDescription")}
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
                  paddingBottom: bottomPad,
                  marginBottom: footerLift,
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
                accessibilityLabel={t("capsuleForm.a11yCancel")}
              >
                <Text style={[styles.actionLabel, { color: palette.cancelLabel }]}>
                  {t("common.cancel")}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSubmit()}
                disabled={isSubmitting || isPending}
                style={({ pressed }) => [
                  styles.actionBtn,
                  pressed && { opacity: 0.55 },
                ]}
                accessibilityLabel={t("capsules.a11ySubmitCapsule", {
                  label: resolvedSubmitLabel,
                })}
              >
                {isSubmitting || isPending ? (
                  <ActivityIndicator color={palette.addLabel} />
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
                    {resolvedSubmitLabel}
                  </Text>
                )}
              </Pressable>
            </View>

            <EmojiPicker
              open={emojiPickerOpen}
              onClose={() => setEmojiPickerOpen(false)}
              onEmojiSelected={(emoji: EmojiType) => {
                void setFieldValue("avatarIcon", emoji.emoji);
              }}
              theme={rnEmojiKeyboardTheme(scheme)}
              translation={emojiKeyboardTranslation(lang)}
              enableSearchBar
              enableRecentlyUsed
              categoryPosition="floating"
              expandable
              defaultHeight="42%"
              expandedHeight="88%"
            />
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

const ACTION_ROW_HEIGHT = 44;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
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
  /** Inner input: no second border — only the row’s `fieldInput` stroke (like Category). */
  iconFieldInput: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    padding: 0,
    fontSize: 16,
    borderWidth: 0,
  },
  iconFieldActions: {
    flexDirection: "row",
    alignItems: "center",
    flexShrink: 0,
    marginLeft: 8,
  },
  iconFieldTrailingBtn: {
    marginLeft: 4,
    justifyContent: "center",
    alignItems: "center",
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
  categoryPickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  categoryPickerText: {
    flex: 1,
    fontSize: 16,
    marginRight: 8,
  },
  catModalRoot: {
    flex: 1,
    justifyContent: "flex-end",
  },
  catModalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: modalBackdropScrim,
  },
  catModalSheet: {
    marginHorizontal: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "70%",
    overflow: "hidden",
  },
  catModalTitle: {
    fontSize: 17,
    fontWeight: "600",
    textAlign: "center",
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
  },
  catModalList: {
    maxHeight: 320,
  },
  catModalFooter: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  catModalDoneBtn: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  catModalDoneLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
  catModalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(60, 60, 67, 0.18)",
  },
  catModalRowLabel: {
    flex: 1,
    fontSize: 17,
    marginRight: 12,
  },
});
