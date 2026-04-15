import { Ionicons } from "@expo/vector-icons";
import { CapsuleAvatar } from "components/capsule/CapsuleAvatar";
import type { CapsuleListRowPalette } from "components/capsule/capsuleUiPalette";
import type { Capsule } from "lib/models/capsule";
import { Pressable, StyleSheet, Text, View, type ColorValue } from "react-native";

export type CapsuleListRowProps = {
  capsule: Capsule;
  palette: CapsuleListRowPalette;
  onPress: () => void;
  onLongPress?: () => void;
  delayLongPressMs?: number;
  selecting?: boolean;
  selected?: boolean;
  tint?: ColorValue;
};

export function CapsuleListRow({
  capsule,
  palette,
  onPress,
  onLongPress,
  delayLongPressMs,
  selecting = false,
  selected = false,
  tint,
}: CapsuleListRowProps) {
  const description = capsule.description?.trim();
  const markColor = selected
    ? (tint ?? palette.textPrimary)
    : palette.textSecondary;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPressMs}
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: palette.listRowSurface },
        pressed && { backgroundColor: palette.rowPressed },
      ]}
    >
      {selecting ? (
        <View style={styles.selectMark}>
          <Ionicons
            name={selected ? "checkmark-circle" : "ellipse-outline"}
            size={26}
            color={markColor}
          />
        </View>
      ) : null}
      <CapsuleAvatar
        capsuleId={capsule.id}
        name={capsule.name}
        emoji={capsule.avatarIcon}
        size={52}
      />
      <View style={styles.rowText}>
        <Text style={[styles.name, { color: palette.textPrimary }]} numberOfLines={1}>
          {capsule.name}
        </Text>
        {description ? (
          <Text
            style={[styles.subtitle, { color: palette.textSecondary }]}
            numberOfLines={2}
          >
            {description}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 72,
  },
  selectMark: {
    width: 32,
    marginRight: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
    justifyContent: "center",
  },
  name: {
    fontSize: 17,
    fontWeight: "600",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },
});

