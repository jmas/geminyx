import type { TFunction } from "i18next";
import { Ionicons } from "@expo/vector-icons";
import { Formik, type FormikHelpers } from "formik";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
  type ColorValue,
} from "react-native";
import { formatError } from "utils/error";
import { logThreadMessage } from "utils/threadMessageLog";
import * as yup from "yup";

export type MessageFormPalette = {
  composerBarBg: ColorValue;
  composerFieldBg: ColorValue;
  composerBorder: ColorValue;
  composerPlaceholder: ColorValue;
  composerText: ColorValue;
  iconSend: ColorValue;
};

export type MessageFormValues = {
  body: string;
};

export const messageFormEmptyValues: MessageFormValues = {
  body: "",
};

export function buildMessageFormValidationSchema(t: TFunction) {
  return yup.object({
    body: yup.string().max(4096, t("messageForm.validationTooLong")),
  });
}

export type MessageFormProps = {
  palette: MessageFormPalette;
  bottomInset: number;
  isPending: boolean;
  disabled?: boolean;
  /** Shown when the field is empty. Defaults to translated “Message”. */
  placeholder?: string;
  onSubmitBody: (body: string) => Promise<void>;
  /** When set, shows a home icon left of the field (capsule root request). */
  onRequestHome?: () => void;
  /** When true, last message is at capsule entry; same action, label "Revisit home" instead of home icon. */
  requestHomeAsRefresh?: boolean;
};

export function MessageForm({
  palette,
  bottomInset,
  isPending,
  disabled = false,
  placeholder,
  onSubmitBody,
  onRequestHome,
  requestHomeAsRefresh = false,
}: MessageFormProps) {
  const { t } = useTranslation();
  const resolvedPlaceholder = placeholder ?? t("messageForm.placeholderDefault");
  const validationSchema = useMemo(
    () => buildMessageFormValidationSchema(t),
    [t],
  );
  return (
    <Formik<MessageFormValues>
      initialValues={messageFormEmptyValues}
      validationSchema={validationSchema}
      onSubmit={async (
        values,
        { resetForm, setFieldValue }: FormikHelpers<MessageFormValues>,
      ) => {
        const text = values.body.trim();
        if (!text || disabled) {
          logThreadMessage("composer.submit.skip", {
            reason: !text ? "empty_body" : "disabled",
            rawLen: values.body.length,
            isPending,
          });
          return;
        }
        logThreadMessage("composer.submit", {
          bodyChars: text.length,
          bodyUtf8Bytes: new TextEncoder().encode(text).length,
          isPending,
        });
        resetForm({ values: messageFormEmptyValues });
        Keyboard.dismiss();
        try {
          await onSubmitBody(text);
        } catch (e) {
          logThreadMessage("composer.submit.error", {
            bodyChars: text.length,
            error: formatError(e, t("common.unknownError")),
          });
          await setFieldValue("body", text);
        }
      }}
    >
      {({ values, handleChange, handleBlur, handleSubmit }) => {
        const canSend =
          values.body.trim().length > 0 && !isPending && !disabled;

        const canHome = Boolean(onRequestHome) && !isPending && !disabled;

        return (
          <View
            style={[
              styles.composerBar,
              {
                backgroundColor: palette.composerBarBg,
                borderTopColor: palette.composerBorder,
                paddingBottom: bottomInset,
              },
            ]}
          >
            {onRequestHome ? (
              <Pressable
                disabled={!canHome}
                onPress={() => {
                  logThreadMessage("composer.home.press", {
                    isPending,
                    disabled,
                    asRefresh: requestHomeAsRefresh,
                  });
                  Keyboard.dismiss();
                  onRequestHome();
                }}
                hitSlop={8}
                style={({ pressed }) => [
                  styles.composerHomePillButton,
                  {
                    backgroundColor: palette.composerFieldBg,
                    borderColor: palette.composerBorder,
                    opacity: pressed && canHome ? 0.65 : 1,
                  },
                  !canHome && styles.composerSendDisabled,
                ]}
                accessibilityLabel={
                  requestHomeAsRefresh
                    ? t("messageForm.a11yRevisitHome")
                    : t("messageForm.a11yVisitHome")
                }
                accessibilityState={{ disabled: !canHome }}
              >
                <View style={styles.composerHomePillContent}>
                  <Ionicons
                    name={
                      requestHomeAsRefresh ? "refresh-outline" : "home-outline"
                    }
                    size={18}
                    color={palette.composerText}
                  />
                </View>
              </Pressable>
            ) : null}
            <View
              style={[
                styles.composerField,
                {
                  backgroundColor: palette.composerFieldBg,
                  borderColor: palette.composerBorder,
                },
              ]}
            >
              <TextInput
                style={[styles.composerInput, { color: palette.composerText }]}
                placeholder={resolvedPlaceholder}
                placeholderTextColor={palette.composerPlaceholder}
                value={values.body}
                onChangeText={handleChange("body")}
                onBlur={handleBlur("body")}
                multiline
                maxLength={4096}
                scrollEnabled
                editable={!isPending && !disabled}
              />
            </View>
            <Pressable
              disabled={!canSend}
              onPress={() => void handleSubmit()}
              hitSlop={8}
              style={({ pressed }) => [
                styles.composerIconButton,
                !canSend && styles.composerSendDisabled,
                pressed && canSend && styles.composerIconPressed,
              ]}
              accessibilityLabel={t("messageForm.a11ySend")}
              accessibilityState={{ disabled: !canSend }}
            >
              <Ionicons name="send" size={22} color={palette.iconSend} />
            </Pressable>
          </View>
        );
      }}
    </Formik>
  );
}

const styles = StyleSheet.create({
  composerBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: 6,
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerField: {
    flex: 1,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    marginHorizontal: 4,
    marginBottom: 2,
    maxHeight: 120,
    justifyContent: "center",
    minHeight: 40,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 10 : 6,
  },
  composerInput: {
    fontSize: 16,
    lineHeight: 20,
    maxHeight: 104,
    paddingVertical: 0,
    ...(Platform.OS === "android" && { textAlignVertical: "top" }),
  },
  composerIconButton: {
    width: 40,
    height: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  composerHomePillButton: {
    minHeight: 40,
    paddingHorizontal: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  composerHomePillContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  composerIconPressed: {
    opacity: 0.55,
  },
  composerSendDisabled: {
    opacity: 0.35,
  },
});
