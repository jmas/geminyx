import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { avatarHueFromId, initialsFromName } from "utils/avatar";

type Props = {
  capsuleId: string;
  name: string;
  uri?: string;
  size: number;
};

export function CapsuleAvatar({ capsuleId, name, uri, size }: Props) {
  const hue = avatarHueFromId(capsuleId);
  const initials = initialsFromName(name);
  const [failed, setFailed] = useState(!uri);

  useEffect(() => {
    setFailed(!uri);
  }, [uri]);

  const radius = size / 2;
  const fontSize = Math.max(12, Math.round(size * 0.36));

  if (!failed && uri) {
    return (
      <Image
        accessibilityLabel={`${name} avatar`}
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius }}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <View
      style={[
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: `hsl(${hue}, 42%, 46%)`,
        },
      ]}
      accessibilityLabel={`${name} avatar`}
    >
      <Text style={[styles.initials, { fontSize }]}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  initials: {
    color: "#ffffff",
    fontWeight: "600",
  },
});
