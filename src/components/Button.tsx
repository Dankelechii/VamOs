import React, { useMemo, useRef } from "react";
import {
  Animated,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useThemeColors } from "../context/ThemeContext";
import { ColorPalette } from "../theme/colors";
import { darken, lighten } from "../theme/colorUtils";

type Variant = "primary" | "outline" | "chip" | "text-danger";
type Size = "default" | "small";

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: keyof typeof Ionicons.glyphMap;
  /** Overrides the icon/label color for the "chip" and "outline" variants (e.g. a red tint for a destructive chip). */
  tint?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
}

export default function Button({
  label,
  onPress,
  variant = "primary",
  size = "default",
  icon,
  tint,
  disabled,
  fullWidth = variant === "primary",
  style,
}: ButtonProps) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors, size), [colors, size]);
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, { toValue: 0.96, useNativeDriver: true, speed: 40, bounciness: 4 }).start();
  const pressOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 30, bounciness: 6 }).start();

  const iconColor =
    variant === "primary" ? "#182242" : variant === "text-danger" ? colors.danger : tint ?? colors.accent;
  const textStyle = [
    styles.label,
    variant === "primary" && styles.labelPrimary,
    variant === "outline" && styles.labelOutline,
    variant === "chip" && styles.labelChip,
    variant === "text-danger" && styles.labelDanger,
    tint && (variant === "chip" || variant === "outline") && { color: tint },
  ];

  const inner = (
    <View style={styles.row}>
      {icon && <Ionicons name={icon} size={size === "small" ? 14 : 17} color={iconColor} style={styles.icon} />}
      <Text style={textStyle}>{label}</Text>
    </View>
  );

  if (variant === "primary") {
    const top = lighten(colors.accent, 0.3);
    const bottom = darken(colors.accent, 0.22);
    return (
      <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }, style]}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={disabled}
          style={[styles.shadowWrap, disabled && styles.disabled]}
        >
          <LinearGradient colors={[top, colors.accent, bottom]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.base}>
            <LinearGradient
              colors={["#FFFFFF80", "#FFFFFF00"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.sheen}
              pointerEvents="none"
            />
            {inner}
          </LinearGradient>
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === "outline") {
    return (
      <Animated.View style={[fullWidth && styles.fullWidth, { transform: [{ scale }] }, style]}>
        <Pressable
          onPress={onPress}
          onPressIn={pressIn}
          onPressOut={pressOut}
          disabled={disabled}
          style={[styles.base, styles.outlineBase, disabled && styles.disabled]}
        >
          {inner}
        </Pressable>
      </Animated.View>
    );
  }

  if (variant === "chip") {
    return (
      <Animated.View style={[{ transform: [{ scale }] }, style]}>
        <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled} style={styles.chipBase}>
          {inner}
        </Pressable>
      </Animated.View>
    );
  }

  // text-danger
  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <Pressable onPress={onPress} onPressIn={pressIn} onPressOut={pressOut} disabled={disabled} hitSlop={8}>
        {inner}
      </Pressable>
    </Animated.View>
  );
}

function createStyles(colors: ColorPalette, size: Size) {
  const height = size === "small" ? 40 : 52;
  return StyleSheet.create({
    fullWidth: { width: "100%" },
    row: { flexDirection: "row", alignItems: "center", justifyContent: "center" },
    icon: { marginRight: 8 },
    shadowWrap: {
      borderRadius: height / 2,
      shadowColor: colors.accent,
      shadowOpacity: 0.4,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    base: {
      height,
      borderRadius: height / 2,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 22,
      overflow: "hidden",
    },
    sheen: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
      height: "55%",
    },
    outlineBase: {
      backgroundColor: colors.card,
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    chipBase: {
      flexDirection: "row",
      alignItems: "center",
      height: size === "small" ? 34 : 40,
      paddingHorizontal: 16,
      borderRadius: 999,
      backgroundColor: "#00000055",
      borderWidth: 1,
      borderColor: "#FFFFFF33",
    },
    disabled: { opacity: 0.5 },
    label: {
      fontSize: size === "small" ? 13 : 15,
      fontWeight: "800",
      letterSpacing: 0.2,
    },
    labelPrimary: { color: "#182242" },
    labelOutline: { color: colors.accent },
    labelChip: { color: colors.white },
    labelDanger: { color: colors.danger, fontWeight: "700" },
  });
}
