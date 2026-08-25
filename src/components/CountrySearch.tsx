import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import { Keyboard, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { WORLD_COUNTRIES } from "../data/worldCountries";
import { ColorPalette } from "../theme/colors";
import { isoToFlagEmoji } from "../utils/flag";

const MAX_RESULTS = 6;

interface CountrySearchProps {
  onSelectCountry: (id: string) => void;
  /** Countries to leave out of the results — a friend's map only shows what's theirs. */
  excludeIds?: Set<string>;
  placeholder?: string;
}

/**
 * A type-to-find alternative to tapping the globe directly. Small, closely-packed
 * countries (a lot of West Africa, the Balkans, Central America) are genuinely hard to
 * land a tap on precisely on a rotating sphere at phone size — this sidesteps that
 * entirely rather than chasing ever-finer tap precision.
 */
export default function CountrySearch({ onSelectCountry, excludeIds, placeholder }: CountrySearchProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    return WORLD_COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) && !excludeIds?.has(c.id)
    ).slice(0, MAX_RESULTS);
  }, [query, excludeIds]);

  const select = (id: string) => {
    onSelectCountry(id);
    setQuery("");
    Keyboard.dismiss();
  };

  // Driven by the query alone, not focus state: hiding results on blur raced against
  // the result row's own onPress on web — blur fires (and hid the list) before the
  // click that was supposed to select something ever landed.
  const showResults = query.trim().length > 0;

  return (
    <View style={styles.wrap}>
      <View style={styles.searchBox}>
        <Ionicons name="search" size={16} color={colors.textMuted} />
        <TextInput
          style={styles.searchInput}
          value={query}
          onChangeText={setQuery}
          placeholder={placeholder ?? "Find a country by name…"}
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
        />
        {query.length > 0 && (
          <Pressable onPress={() => setQuery("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {showResults && (
        <View style={styles.resultsBox}>
          {results.length === 0 ? (
            <Text style={styles.emptyLine}>No country matches "{query.trim()}".</Text>
          ) : (
            results.map((c) => (
              <Pressable key={c.id} style={styles.resultRow} onPress={() => select(c.id)}>
                <Text style={styles.resultFlag}>{isoToFlagEmoji(c.iso2)}</Text>
                <Text style={styles.resultName} numberOfLines={1}>
                  {c.name}
                </Text>
              </Pressable>
            ))
          )}
        </View>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrap: {},
    searchBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      backgroundColor: colors.card,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
    },
    searchInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 11 },
    // Laid out inline (pushes the globe down) rather than absolutely-positioned over
    // it: an overlay here sat visually on top of the WebGL canvas but taps on it
    // weren't reliably reaching the result rows underneath — sidestepped entirely by
    // not overlapping the canvas at all.
    resultsBox: {
      marginTop: 6,
      backgroundColor: colors.bgElevated,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingVertical: 4,
      shadowColor: "#000",
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 8,
    },
    resultRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    resultFlag: { fontSize: 18 },
    resultName: { flex: 1, color: colors.textPrimary, fontSize: 14, fontWeight: "600" },
    emptyLine: { color: colors.textMuted, fontSize: 13, paddingHorizontal: 14, paddingVertical: 12 },
  });
}
