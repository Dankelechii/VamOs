import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import ChecklistRow from "./ChecklistRow";
import { useThemeColors } from "../context/ThemeContext";
import { useTravel } from "../context/TravelContext";
import { ColorPalette } from "../theme/colors";

/**
 * The pre-trip to-do list that sits under the map.
 *
 * Sorted so unfinished work stays at the top and completed items sink — otherwise a
 * long-lived list turns into a field of struck-through text you have to read past to
 * find what's left. Original order is preserved within each group.
 */
export default function TravelChecklist() {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const {
    checklist,
    addChecklistItem,
    toggleChecklistItem,
    removeChecklistItem,
    clearCompletedChecklistItems,
  } = useTravel();

  const [draft, setDraft] = useState("");

  const done = checklist.filter((i) => i.done).length;
  const total = checklist.length;
  const pct = total > 0 ? done / total : 0;

  const ordered = useMemo(
    () => [...checklist.filter((i) => !i.done), ...checklist.filter((i) => i.done)],
    [checklist]
  );

  const progress = useRef(new Animated.Value(pct)).current;
  useEffect(() => {
    Animated.timing(progress, {
      toValue: pct,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      // Animating width, which the native driver can't take.
      useNativeDriver: false,
    }).start();
  }, [pct]);

  const submit = () => {
    addChecklistItem(draft);
    setDraft("");
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Travel checklist</Text>
        {total > 0 && (
          <Text style={styles.count}>
            {done} of {total} done
          </Text>
        )}
      </View>

      <View style={styles.card}>
        {total > 0 && (
          <View style={styles.track}>
            <Animated.View
              style={[
                styles.fill,
                {
                  width: progress.interpolate({
                    inputRange: [0, 1],
                    outputRange: ["0%", "100%"],
                  }),
                },
              ]}
            />
          </View>
        )}

        {total === 0 ? (
          <Text style={styles.empty}>
            Nothing on the list. Add what you need to sort before you go.
          </Text>
        ) : (
          ordered.map((item) => (
            <ChecklistRow
              key={item.id}
              item={item}
              onToggle={() => toggleChecklistItem(item.id)}
              onRemove={() => removeChecklistItem(item.id)}
            />
          ))
        )}

        <View style={styles.addRow}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={submit}
            returnKeyType="done"
            blurOnSubmit={false}
            placeholder="Add something to do…"
            placeholderTextColor={colors.textMuted}
          />
          <Pressable
            onPress={submit}
            disabled={!draft.trim()}
            hitSlop={8}
            style={[styles.addButton, !draft.trim() && styles.addButtonDisabled]}
            accessibilityLabel="Add checklist item"
          >
            <Ionicons name="add" size={20} color={colors.bgElevated} />
          </Pressable>
        </View>

        {done > 0 && (
          <Pressable onPress={clearCompletedChecklistItems} hitSlop={8} style={styles.clear}>
            <Text style={styles.clearText}>
              Clear {done} completed
            </Text>
          </Pressable>
        )}
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: { marginTop: 24, paddingHorizontal: 12 },
    header: {
      flexDirection: "row",
      alignItems: "baseline",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      marginBottom: 10,
    },
    title: {
      color: colors.textSecondary,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    count: { color: colors.textMuted, fontSize: 12 },
    card: {
      backgroundColor: colors.card,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 14,
      paddingTop: 14,
      paddingBottom: 10,
    },
    track: {
      height: 4,
      borderRadius: 2,
      backgroundColor: colors.cardBorder,
      overflow: "hidden",
      marginBottom: 6,
    },
    fill: { height: "100%", borderRadius: 2, backgroundColor: colors.accent },
    empty: {
      color: colors.textMuted,
      fontSize: 13,
      lineHeight: 19,
      paddingVertical: 10,
    },
    addRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      marginTop: 8,
      paddingTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.cardBorder,
    },
    input: {
      flex: 1,
      color: colors.textPrimary,
      fontSize: 14,
      paddingVertical: 6,
    },
    addButton: {
      width: 30,
      height: 30,
      borderRadius: 15,
      backgroundColor: colors.accent,
      alignItems: "center",
      justifyContent: "center",
    },
    addButtonDisabled: { opacity: 0.35 },
    clear: { alignSelf: "flex-start", marginTop: 10, paddingVertical: 4 },
    clearText: { color: colors.textMuted, fontSize: 12, fontWeight: "600" },
  });
}
