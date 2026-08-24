import React, { useEffect, useState } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Button from "./Button";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/**
 * Month + year picker, built from plain Pressables.
 *
 * Deliberately not @react-native-community/datetimepicker: that's another native
 * dependency, renders inconsistently on web, and day-precision is more than a travel
 * log needs. Returns ISO `YYYY-MM-01`, or null when the date is cleared.
 */
export default function MonthYearPicker({
  visible,
  title,
  value,
  minValue,
  onClose,
  onSelect,
}: {
  visible: boolean;
  title: string;
  value?: string;
  /** Clamp to on-or-after this month — an end date can't precede its start. */
  minValue?: string;
  onClose: () => void;
  onSelect: (iso: string | null) => void;
}) {
  const colors = useThemeColors();
  const styles = React.useMemo(() => createStyles(colors), [colors]);

  const parsedYear = value ? Number(value.slice(0, 4)) : NaN;
  const [year, setYear] = useState<number>(
    Number.isFinite(parsedYear) ? parsedYear : new Date().getFullYear()
  );

  // Reopening on a different trip should land on that trip's year, not the last one.
  useEffect(() => {
    if (!visible) return;
    const y = value ? Number(value.slice(0, 4)) : NaN;
    setYear(Number.isFinite(y) ? y : new Date().getFullYear());
  }, [visible, value]);

  const selectedMonth = value && Number(value.slice(0, 4)) === year ? Number(value.slice(5, 7)) : 0;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>{title}</Text>

          <View style={styles.yearRow}>
            <Pressable onPress={() => setYear((y) => y - 1)} hitSlop={12} style={styles.yearArrow}>
              <Text style={styles.yearArrowText}>‹</Text>
            </Pressable>
            <Text style={styles.yearText}>{year}</Text>
            <Pressable onPress={() => setYear((y) => y + 1)} hitSlop={12} style={styles.yearArrow}>
              <Text style={styles.yearArrowText}>›</Text>
            </Pressable>
          </View>

          <View style={styles.grid}>
            {MONTHS.map((label, i) => {
              const iso = `${year}-${String(i + 1).padStart(2, "0")}-01`;
              const disabled = !!minValue && iso < minValue;
              const selected = selectedMonth === i + 1;
              return (
                <Pressable
                  key={label}
                  disabled={disabled}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                  style={[
                    styles.month,
                    selected && styles.monthSelected,
                    disabled && styles.monthDisabled,
                  ]}
                >
                  <Text
                    style={[
                      styles.monthText,
                      selected && styles.monthTextSelected,
                      disabled && styles.monthTextDisabled,
                    ]}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <View style={styles.actions}>
            <Button
              label="Clear"
              variant="outline"
              size="small"
              onPress={() => {
                onSelect(null);
                onClose();
              }}
            />
            <Button label="Cancel" variant="outline" size="small" onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: "#000000AA",
      justifyContent: "center",
      alignItems: "center",
      padding: 24,
    },
    sheet: {
      width: "100%",
      maxWidth: 340,
      backgroundColor: colors.bgElevated,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 18,
    },
    title: {
      color: colors.textPrimary,
      fontSize: 16,
      fontWeight: "800",
      textAlign: "center",
      marginBottom: 12,
    },
    yearRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 24,
      marginBottom: 14,
    },
    yearArrow: { paddingHorizontal: 10, paddingVertical: 2 },
    yearArrowText: { color: colors.accent, fontSize: 26, fontWeight: "700", lineHeight: 30 },
    yearText: {
      color: colors.textPrimary,
      fontSize: 20,
      fontWeight: "800",
      minWidth: 68,
      textAlign: "center",
    },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: 8, justifyContent: "center" },
    month: {
      width: 88,
      paddingVertical: 10,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.card,
      alignItems: "center",
    },
    monthSelected: { backgroundColor: colors.accent, borderColor: colors.accent },
    monthDisabled: { opacity: 0.35 },
    monthText: { color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    monthTextSelected: { color: colors.bgElevated, fontWeight: "800" },
    monthTextDisabled: { color: colors.textMuted },
    actions: { flexDirection: "row", justifyContent: "center", gap: 12, marginTop: 16 },
  });
}
