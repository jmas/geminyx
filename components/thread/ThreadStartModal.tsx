import { useQuery } from "@tanstack/react-query";
import { CapsuleListRow } from "components/capsule/CapsuleListRow";
import { selectCapsuleUiPalette } from "components/capsule/capsuleUiPalette";
import { useAccountActive } from "hooks/account/useAccountActive";
import type { Capsule } from "lib/models/capsule";
import { queryKeys } from "lib/queryKeys";
import { systemBlueForScheme } from "lib/theme/appColors";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  useColorScheme,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { capsulesRepo, type CapsuleListSection } from "repositories";
import { geminiUrlForThreadNavigationOrAlert } from "utils/geminiUrlNavigation";

export type ThreadStartModalCloseResult =
  | { cancelled: true }
  | { capsuleId: string }
  | { url: string };

export type ThreadStartModalProps = {
  /** Injected by react-popup-manager */
  isOpen: boolean;
  /** Injected by react-popup-manager */
  onClose?: (result?: ThreadStartModalCloseResult) => void;
};

export function ThreadStartModal({ isOpen, onClose }: ThreadStartModalProps) {
  const { t } = useTranslation();
  const dismiss = onClose ?? (() => {});
  const scheme = useColorScheme();
  const palette = selectCapsuleUiPalette(scheme);
  const insets = useSafeAreaInsets();
  const tint = systemBlueForScheme(scheme);

  const { data: activeAccount } = useAccountActive({ refetchOnFocus: false });
  const accountId = activeAccount?.id ?? "";

  const [draftUrl, setDraftUrl] = useState("");

  const { data: sections = [], isPending } = useQuery({
    queryKey: [...queryKeys.capsules.listForActive(), accountId || "none"],
    queryFn: async () => {
      if (!accountId) return [];
      return capsulesRepo.listSectionsForAccount(accountId);
    },
    enabled: isOpen && Boolean(accountId),
  });

  const showSections = useMemo(() => {
    return sections.filter((s) => s.data.length > 0);
  }, [sections]);

  const closeCancelled = useCallback(() => {
    dismiss({ cancelled: true });
  }, [dismiss]);

  const submitUrl = useCallback(() => {
    const ok = geminiUrlForThreadNavigationOrAlert(draftUrl);
    if (!ok) return;
    setDraftUrl("");
    dismiss({ url: ok });
  }, [dismiss, draftUrl]);

  const onPickCapsule = useCallback(
    (capsule: Capsule) => {
      setDraftUrl("");
      dismiss({ capsuleId: capsule.id });
    },
    [dismiss],
  );

  return (
    <Modal
      visible={isOpen}
      animationType="slide"
      presentationStyle={Platform.OS === "ios" ? "pageSheet" : "fullScreen"}
      onRequestClose={closeCancelled}
    >
      <View style={[styles.root, { backgroundColor: palette.background }]}>
        <View style={styles.grabberWrap}>
          <View style={[styles.grabber, { backgroundColor: palette.sheetHandle }]} />
        </View>

        <Text style={[styles.title, { color: palette.sheetTitle }]} accessibilityRole="header">
          {t("threads.startModalTitle")}
        </Text>

        <TouchableWithoutFeedback
          onPress={() => Keyboard.dismiss()}
          accessible={false}
        >
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            style={styles.content}
          >
            <Text style={[styles.label, { color: palette.textSecondary }]}>
              {t("threads.startModalUrlLabel")}
            </Text>
            <TextInput
              value={draftUrl}
              onChangeText={setDraftUrl}
              placeholder={t("threads.startModalUrlPlaceholder")}
              placeholderTextColor={palette.textSecondary}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
              returnKeyType="go"
              onSubmitEditing={submitUrl}
              style={[
                styles.urlInput,
                {
                  borderColor: palette.separator,
                  color: palette.textPrimary,
                  backgroundColor: palette.listRowSurface,
                },
              ]}
            />

            <Text style={[styles.label, { color: palette.textSecondary }]}>
              {t("threads.startModalCapsulesLabel")}
            </Text>

            <SectionList<Capsule, CapsuleListSection>
              sections={showSections}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode={Platform.OS === "ios" ? "on-drag" : "none"}
              onScrollBeginDrag={() => Keyboard.dismiss()}
              stickySectionHeadersEnabled
              contentContainerStyle={styles.listContent}
              renderSectionHeader={({ section: { title, categoryId } }) => (
                <View
                  style={[
                    styles.sectionHeader,
                    { backgroundColor: palette.background },
                  ]}
                >
                  <Text
                    style={[
                      styles.sectionHeaderText,
                      { color: palette.textSecondary },
                    ]}
                  >
                    {categoryId === null ? t("capsules.sectionGeneral") : title}
                  </Text>
                </View>
              )}
              ItemSeparatorComponent={() => (
                <View
                  style={[
                    styles.separator,
                    { backgroundColor: palette.separator, marginLeft: 16 + 52 + 12 },
                  ]}
                />
              )}
              renderItem={({ item }) => (
                <CapsuleListRow
                  capsule={item}
                  palette={palette}
                  onPress={() => {
                    Keyboard.dismiss();
                    onPickCapsule(item);
                  }}
                />
              )}
              ListEmptyComponent={
                isPending ? (
                  <Text style={[styles.emptyHint, { color: palette.textSecondary }]}>
                    {t("common.loading")}
                  </Text>
                ) : (
                  <Text style={[styles.emptyHint, { color: palette.textSecondary }]}>
                    {t("threads.startModalNoCapsules")}
                  </Text>
                )
              }
            />
          </KeyboardAvoidingView>
        </TouchableWithoutFeedback>

        <View
          style={[
            styles.footer,
            {
              borderTopColor: palette.separator,
              paddingBottom: Math.max(insets.bottom, 12),
              backgroundColor: palette.background,
            },
          ]}
        >
          <Pressable
            onPress={closeCancelled}
            style={({ pressed }) => [styles.footerBtn, pressed && { opacity: 0.55 }]}
            accessibilityRole="button"
            accessibilityLabel={t("common.cancel")}
          >
            <Text style={[styles.footerBtnLabel, { color: palette.cancelLabel }]}>
              {t("common.cancel")}
            </Text>
          </Pressable>
          <Pressable
            onPress={submitUrl}
            disabled={!draftUrl.trim()}
            style={({ pressed }) => [
              styles.footerBtn,
              pressed && { opacity: 0.55 },
              !draftUrl.trim() && { opacity: 0.35 },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t("common.open")}
          >
            <Text style={[styles.footerBtnLabel, { color: tint }]}>
              {t("common.open")}
            </Text>
          </Pressable>
        </View>
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
    paddingHorizontal: 20,
  },
  content: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 6,
  },
  urlInput: {
    marginHorizontal: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
  },
  listContent: {
    paddingBottom: 16,
  },
  sectionHeader: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 6,
    backgroundColor: "transparent",
  },
  sectionHeaderText: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
  },
  emptyHint: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    fontSize: 15,
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 20,
    paddingTop: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  footerBtn: {
    minHeight: 44,
    minWidth: 120,
    justifyContent: "center",
    alignItems: "center",
  },
  footerBtnLabel: {
    fontSize: 17,
    fontWeight: "600",
  },
});

