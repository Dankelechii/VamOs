import Ionicons from "@expo/vector-icons/Ionicons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View, ViewStyle } from "react-native";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";

const NAV_HEIGHT = 64;
export const WEB_TOP_NAV_HEIGHT = NAV_HEIGHT;

const ROUTE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  Map: "map",
  Friends: "people",
  Profile: "person-circle",
};

/**
 * The website-mode replacement for the bottom tab bar. Same navigation state/actions
 * as the default tab bar (this is a `tabBar` render-prop swap, not a different
 * navigator), just laid out and styled like a site header instead of a phone's tab
 * strip — fixed to the top, a wordmark on the left, hoverable nav links on the right.
 */
export default function WebTopNav({ state, navigation }: BottomTabBarProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <View style={styles.bar}>
      <View style={styles.inner}>
        <View style={styles.brand}>
          <Image
            source={require("../../assets/logo-mark-transparent.png")}
            style={styles.brandMark}
            resizeMode="contain"
          />
          <Text style={styles.brandName}>VamOs</Text>
        </View>

        <View style={styles.links}>
          {state.routes.map((route, index) => {
            const focused = state.index === index;
            const icon = ROUTE_ICON[route.name] ?? "ellipse";

            const onPress = () => {
              const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            };

            return (
              <Pressable
                key={route.key}
                onPress={onPress}
                style={({ hovered, pressed }: any) => [
                  styles.link,
                  focused && styles.linkActive,
                  hovered && !focused && styles.linkHovered,
                  pressed && styles.linkPressed,
                ]}
              >
                <Ionicons name={icon} size={17} color={focused ? colors.accent : colors.textSecondary} />
                <Text style={[styles.linkText, focused && styles.linkTextActive]}>{route.name}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    bar: {
      height: NAV_HEIGHT,
      backgroundColor: colors.bgElevated,
      borderBottomWidth: 1,
      borderBottomColor: colors.cardBorder,
      // Website mode only ever runs on web, so this is safe: fixed to the viewport
      // rather than the document, the header stays put while a tall screen scrolls
      // underneath it instead of scrolling away with the content. Cast (rather than a
      // suppression comment) so it doesn't wreck inference for the sibling styles below.
      position: "fixed" as ViewStyle["position"],
      top: 0,
      left: 0,
      right: 0,
      zIndex: 100,
    },
    inner: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      maxWidth: 1100,
      width: "100%",
      alignSelf: "center",
      paddingHorizontal: 24,
    },
    brand: { flexDirection: "row", alignItems: "center", gap: 10 },
    brandMark: { width: 26, height: 26 },
    brandName: {
      color: colors.accent,
      fontSize: 15,
      fontWeight: "800",
      letterSpacing: 0.6,
      textTransform: "uppercase",
    },
    links: { flexDirection: "row", alignItems: "center", gap: 4 },
    link: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 16,
      paddingVertical: 9,
      borderRadius: 10,
    },
    linkHovered: { backgroundColor: colors.accentSoft },
    linkPressed: { opacity: 0.7 },
    linkActive: { backgroundColor: colors.accentSoft },
    linkText: { color: colors.textSecondary, fontSize: 14, fontWeight: "700" },
    linkTextActive: { color: colors.accent },
  });
}
