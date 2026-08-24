import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { getCountryById } from "../data/countryLookup";
import { formatTripDates, TimelineEntry } from "../data/trips";
import { ColorPalette } from "../theme/colors";
import { isoToFlagEmoji } from "../utils/flag";

/**
 * Every trip in one chronological column — the view the trip model exists to make
 * possible. A country-keyed map can only answer "where have you been"; this answers
 * "what have you done", which is the more interesting question.
 */
export default function TripTimeline({
  entries,
  onPressTrip,
  onShowMore,
  maxEntries = 8,
}: {
  entries: TimelineEntry[];
  onPressTrip?: (entry: TimelineEntry) => void;
  /** Omit to leave the overflow line as plain text rather than a dead-end control. */
  onShowMore?: () => void;
  maxEntries?: number;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  if (entries.length === 0) {
    return (
      <View style={styles.empty}>
        <Text style={styles.emptyText}>Mark a country visited and your trips land here.</Text>
      </View>
    );
  }

  const shown = entries.slice(0, maxEntries);
  const hidden = entries.length - shown.length;

  return (
    <View style={styles.list}>
      {shown.map((entry, i) => {
        const country = getCountryById(entry.countryId);
        const isLast = i === shown.length - 1 && hidden === 0;
        return (
          <Pressable
            key={entry.trip.id}
            style={styles.row}
            onPress={() => onPressTrip?.(entry)}
            disabled={!onPressTrip}
          >
            <View style={styles.rail}>
              <View style={styles.dot} />
              {!isLast && <View style={styles.line} />}
            </View>
            <View style={styles.body}>
              <Text style={styles.dates}>{formatTripDates(entry.trip)}</Text>
              <Text style={styles.title} numberOfLines={1}>
                {isoToFlagEmoji(country?.iso2)} {entry.trip.title || country?.name || "Trip"}
              </Text>
              {!!entry.trip.title && country && (
                <Text style={styles.subtitle} numberOfLines={1}>
                  {country.name}
                </Text>
              )}
              {entry.trip.photos.length > 0 && (
                <Text style={styles.meta}>
                  {entry.trip.photos.length} photo{entry.trip.photos.length === 1 ? "" : "s"}
                </Text>
              )}
            </View>
          </Pressable>
        );
      })}
      {hidden > 0 &&
        (onShowMore ? (
          <Pressable onPress={onShowMore} hitSlop={8}>
            <Text style={[styles.more, styles.moreLink]}>
              Show {hidden} earlier trip{hidden === 1 ? "" : "s"}
            </Text>
          </Pressable>
        ) : (
          <Text style={styles.more}>
            + {hidden} earlier trip{hidden === 1 ? "" : "s"}
          </Text>
        ))}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    list: { paddingHorizontal: 20 },
    row: { flexDirection: "row" },
    rail: { width: 22, alignItems: "center" },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 5,
      marginTop: 5,
      backgroundColor: colors.accent,
    },
    line: { flex: 1, width: 2, backgroundColor: colors.cardBorder, marginTop: 2 },
    body: { flex: 1, paddingBottom: 18, paddingLeft: 4 },
    dates: {
      color: colors.accent,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    title: { color: colors.textPrimary, fontSize: 15, fontWeight: "700", marginTop: 2 },
    subtitle: { color: colors.textSecondary, fontSize: 12, marginTop: 1 },
    meta: { color: colors.textMuted, fontSize: 11, marginTop: 3 },
    more: { color: colors.textMuted, fontSize: 12, marginLeft: 26, marginTop: -6 },
    moreLink: { color: colors.accent, fontWeight: "700" },
    empty: { paddingHorizontal: 20, paddingVertical: 24 },
    emptyText: { color: colors.textMuted, fontSize: 13 },
  });
}
