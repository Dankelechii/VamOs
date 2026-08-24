import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";

export default function StatBadge({ value, label }: { value: string | number; label: string }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  return (
    <View style={styles.container}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    container: {
      alignItems: "center",
      paddingHorizontal: 16,
    },
    value: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
    },
    label: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 2,
    },
  });
}
