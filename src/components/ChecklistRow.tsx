import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";
import { ChecklistItem } from "../types";

/**
 * One checklist line: a tick box, the text, and a delete control.
 *
 * The tick is its own component mainly so the check animation has somewhere to keep
 * state — a spring on the box and a cross-fade on the mark, driven off `done`, so
 * ticking something off feels like an action rather than a re-render.
 */
export default function ChecklistRow({
  item,
  onToggle,
  onRemove,
}: {
  item: ChecklistItem;
  onToggle: () => void;
  onRemove: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const check = useRef(new Animated.Value(item.done ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.spring(check, {
      toValue: item.done ? 1 : 0,
      friction: 6,
      tension: 90,
      useNativeDriver: true,
    }).start();
  }, [item.done]);

  const handlePress = () => {
    pop.setValue(0.88);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }).start();
    onToggle();
  };

  return (
    <View style={styles.row}>
      <Pressable
        onPress={handlePress}
        hitSlop={8}
        style={styles.tapTarget}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        accessibilityLabel={item.text}
      >
        <Animated.View
          style={[
            styles.box,
            item.done && styles.boxDone,
            { transform: [{ scale: pop }] },
          ]}
        >
          <Animated.View style={{ opacity: check, transform: [{ scale: check }] }}>
            <Ionicons name="checkmark" size={15} color={colors.bgElevated} />
          </Animated.View>
        </Animated.View>

        <Text style={[styles.text, item.done && styles.textDone]} numberOfLines={3}>
          {item.text}
        </Text>
      </Pressable>

      <Pressable onPress={onRemove} hitSlop={10} accessibilityLabel={`Delete ${item.text}`}>
        <Ionicons name="close" size={16} color={colors.textMuted} />
      </Pressable>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 9,
      gap: 10,
    },
    // The whole label is the tap target, not just the 22px box.
    tapTarget: { flex: 1, flexDirection: "row", alignItems: "center", gap: 11 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 7,
      borderWidth: 1.5,
      borderColor: colors.cardBorder,
      alignItems: "center",
      justifyContent: "center",
    },
    boxDone: { backgroundColor: colors.accent, borderColor: colors.accent },
    text: { flex: 1, color: colors.textPrimary, fontSize: 14, lineHeight: 19 },
    textDone: {
      color: colors.textMuted,
      textDecorationLine: "line-through",
    },
  });
}
