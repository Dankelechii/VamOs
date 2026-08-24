import React, { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";
import Ionicons from "@expo/vector-icons/Ionicons";
import { BADGE_TIERS, getCurrentBadge, getNextBadge } from "../data/badges";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";

export default function BadgeRow({
  continentCount,
  ownerLabel,
}: {
  continentCount: number;
  ownerLabel?: string; // e.g. "you've" vs "they've" — omit for a compact/read-only display
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const current = getCurrentBadge(continentCount);
  const next = getNextBadge(continentCount);

  return (
    <View>
      <View style={styles.row}>
        {BADGE_TIERS.map((tier) => {
          const earned = continentCount >= tier.threshold;
          return (
            <View key={tier.id} style={styles.badgeSlot}>
              <View
                style={[
                  styles.badgeCircle,
                  earned
                    ? { backgroundColor: tier.color, borderColor: tier.color }
                    : { backgroundColor: colors.card, borderColor: colors.cardBorder },
                ]}
              >
                {earned ? (
                  <Ionicons name="trophy" size={16} color={tier.id === "yellow" || tier.id === "silver" || tier.id === "platinum" ? "#182242" : colors.white} />
                ) : (
                  <Ionicons name="lock-closed" size={13} color={colors.textMuted} />
                )}
              </View>
              <Text style={[styles.badgeLabel, earned ? { color: colors.textPrimary } : { color: colors.textMuted }]} numberOfLines={1}>
                {tier.name}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.progressText}>
        {current
          ? `${ownerLabel ?? ""} earned the ${current.name} badge — ${continentCount} of 7 continents visited.`
          : `${ownerLabel ?? ""} no badge yet — visit a country to earn your first continent badge.`}
        {next ? ` Next: ${next.name} at ${next.threshold} continent${next.threshold === 1 ? "" : "s"}.` : " All 7 badges collected!"}
      </Text>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    row: { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 4 },
    badgeSlot: { alignItems: "center", width: 44 },
    badgeCircle: {
      width: 36,
      height: 36,
      borderRadius: 18,
      borderWidth: 2,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: 4,
    },
    badgeLabel: { fontSize: 9, fontWeight: "600", textAlign: "center" },
    progressText: {
      color: colors.textSecondary,
      fontSize: 12,
      marginTop: 12,
      lineHeight: 17,
      paddingHorizontal: 4,
    },
  });
}
