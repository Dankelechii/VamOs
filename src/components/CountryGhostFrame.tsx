import React, { useMemo } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path } from "react-native-svg";
import { getCountryById, getCountryFrameBounds } from "../data/countryLookup";

/**
 * The outline of one country, ghosted, sized to fill the given box.
 *
 * The shape is drawn from its own bounds rather than the shared world viewBox —
 * against the whole world most countries render as a speck.
 *
 * It deliberately *fits* the box rather than overflowing it: a View clips its
 * children by default on RN Web and on Android, so an oversized outline would be
 * cropped back to a rectangle on two of the three targets (and a country cropped to
 * a rectangle stops being recognisable). The frame effect comes from the photo being
 * inset well inside the box instead — see PhotoWheelCarousel's card constants.
 */
export default function CountryGhostFrame({
  countryId,
  width,
  height,
  color,
}: {
  countryId: string;
  width: number;
  height: number;
  color: string;
}) {
  const country = useMemo(() => getCountryById(countryId), [countryId]);
  const bounds = useMemo(() => getCountryFrameBounds(countryId), [countryId]);

  if (!country || !bounds) return null;

  const [[minX, minY], [maxX, maxY]] = bounds;
  const w = Math.max(maxX - minX, 0.001);
  const h = Math.max(maxY - minY, 0.001);

  // Breathing room so the outline stroke isn't clipped at the viewport edge.
  const pad = Math.max(w, h) * 0.05;
  const viewBox = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;
  // Stroke is specified in viewBox units, so it has to be derived from the shape's
  // own scale to land at a consistent on-screen weight.
  const strokeWidth = Math.max(w, h) * 0.011;

  return (
    <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
      <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
        <Path
          d={country.path}
          fill={color}
          fillOpacity={0.15}
          stroke={color}
          strokeOpacity={0.55}
          strokeWidth={strokeWidth}
          strokeLinejoin="round"
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", justifyContent: "center" },
});
