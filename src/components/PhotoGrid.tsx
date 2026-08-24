import React, { useMemo } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions, Pressable } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";
import { Photo } from "../types";

const GAP = 3;
const COLUMNS = 3;

export default function PhotoGrid({
  photos,
  onPressPhoto,
  availableWidth,
  emptyLabel,
  cornerRadius = 0,
}: {
  photos: Photo[];
  onPressPhoto?: (photo: Photo) => void;
  /** Defaults to the full window — pass the real width when nested inside padding. */
  availableWidth?: number;
  emptyLabel?: string;
  cornerRadius?: number;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const gridWidth = availableWidth ?? width;
  const size = (gridWidth - GAP * (COLUMNS - 1)) / COLUMNS;

  if (photos.length === 0) {
    return (
      <View style={styles.empty}>
        {emptyLabel ? (
          <Text style={styles.emptyText}>{emptyLabel}</Text>
        ) : (
          <View style={styles.emptyIconCircle} />
        )}
      </View>
    );
  }

  return (
    <View style={styles.grid}>
      {photos.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => onPressPhoto?.(p)}
          style={{ width: size, height: size }}
        >
          <Image source={{ uri: p.uri }} style={[styles.image, { borderRadius: cornerRadius }]} />
        </Pressable>
      ))}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    // `gap` rather than space-between: a row holding fewer than COLUMNS photos was
    // being pushed out to both edges with a hole in the middle.
    grid: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: GAP,
    },
    image: {
      width: "100%",
      height: "100%",
      backgroundColor: colors.card,
    },
    empty: {
      paddingVertical: 20,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyText: { color: colors.textMuted, fontSize: 12 },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: colors.cardBorder,
    },
  });
}
