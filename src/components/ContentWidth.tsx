import React from "react";
import { StyleProp, View, ViewStyle } from "react-native";
import { useLayoutMode } from "../context/LayoutModeContext";

interface ContentWidthProps {
  children: React.ReactNode;
  /** Most screens read best around 640-720; the map's two-column layout wants more room. */
  maxWidth?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Caps and centers content on wide viewports. Without this, every screen just
 * stretches its phone-shaped layout edge to edge on a desktop browser window — text
 * lines running the full width of a monitor, buttons the width of a house. A no-op in
 * mobile mode and on native, where the viewport is already phone-width.
 */
export default function ContentWidth({ children, maxWidth = 680, style }: ContentWidthProps) {
  const { mode } = useLayoutMode();
  if (mode !== "website") return <>{children}</>;
  return (
    <View style={[{ width: "100%", maxWidth, alignSelf: "center" }, style]}>{children}</View>
  );
}
