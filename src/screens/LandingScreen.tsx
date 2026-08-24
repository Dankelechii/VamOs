import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useNavigation } from "@react-navigation/native";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, Pressable, StyleSheet, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { RootStackParamList } from "../navigation/types";
import { BRAND_CREAM, BRAND_NAVY } from "../theme/colors";

// A fixed brand-cream splash moment — deliberately NOT theme-aware. The logo's own
// navy wordmark only reads on a light ground, and a launch screen showing the same
// identity regardless of the user's dark/light preference is the standard, expected
// pattern for a brand splash (matches the native app icon/splash background too).

const LOGO_WIDTH = 300;
const LOGO_HEIGHT = Math.round((LOGO_WIDTH * 433) / 995);

const HOLD_MS = 3000;

/**
 * The logo assembles itself: the plane flies its trail's own curve into place.
 *
 * The three layers are cut from one raster on a shared canvas, so at rest they
 * recompose into the logo exactly. Crucially the trail never moves — it's revealed
 * in place, left to right, by a cream cover sliding off it. An earlier version
 * translated the whole gold layer in from off to one side, which dragged the arc
 * straight across the globe on the way; nothing is displaced now, so the structure
 * of the logo holds through every frame.
 *
 * The numbers below are the trail's own centreline, traced out of the artwork
 * (geodata/split_arc_plane.py) and converted from asset pixels to layout points.
 * The cover's leading edge and the plane share one driver, so the trail is drawn
 * exactly as far as the plane has flown — the plane is always at the tip of its own
 * trail rather than racing it or lagging behind.
 */
const FLIGHT_STOPS = [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1];
const PLANE_X = [-122.4, -107.3, -92, -76.6, -61.2, -46.1, -30.8, -15.4, 0];
const PLANE_Y = [35, 48.5, 55.9, 57.9, 55.6, 49.4, 38.6, 22, 0];
// Banking, heavily damped from the true tangent: the trail hooks almost vertically at
// its tail, and a plane pitched at the real 97° there reads as a crash, not a swoop.
const PLANE_ROT = ["31deg", "29deg", "23deg", "17deg", "13deg", "8deg", "4deg", "1deg", "0deg"];
const COVER_X = [134.2, 149.2, 164.6, 180, 195.4, 210.5, 225.8, 241.2, 256.6];

// The plane occupies a small corner of a full-size layer, and a transform rotates a
// view about the view's own centre — so rotating the layer swung the plane off its
// path on a wide arc of its own. These offsets move the pivot onto the plane itself
// (its centre, relative to the layer's), applied as translate → rotate → un-translate.
const PIVOT_X = 107.9;
const PIVOT_Y = -39.9;

export default function LandingScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const wordOpacity = useRef(new Animated.Value(0)).current;
  const wordScale = useRef(new Animated.Value(0.92)).current;
  const flight = useRef(new Animated.Value(0)).current;
  const taglineOpacity = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  const navigatedRef = useRef(false);

  const goToApp = () => {
    if (navigatedRef.current) return;
    navigatedRef.current = true;
    navigation.replace("Tabs");
  };

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(wordOpacity, {
          toValue: 1,
          duration: 460,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.spring(wordScale, {
          toValue: 1,
          friction: 7,
          tension: 60,
          useNativeDriver: true,
        }),
      ]),
      Animated.timing(flight, {
        toValue: 1,
        duration: 1150,
        // Eases in and out, so the plane gathers speed off the tail and glides to a
        // stop rather than arriving at full pelt.
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(taglineOpacity, {
        toValue: 1,
        duration: 350,
        useNativeDriver: true,
      }),
    ]).start();

    // Idle drift, so the finished logo is never perfectly still.
    Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 2200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setTimeout(goToApp, HOLD_MS);
    return () => clearTimeout(timer);
  }, []);

  const planeTranslateX = flight.interpolate({ inputRange: FLIGHT_STOPS, outputRange: PLANE_X });
  const planeTranslateY = flight.interpolate({ inputRange: FLIGHT_STOPS, outputRange: PLANE_Y });
  const planeRotate = flight.interpolate({ inputRange: FLIGHT_STOPS, outputRange: PLANE_ROT });
  const coverTranslateX = flight.interpolate({ inputRange: FLIGHT_STOPS, outputRange: COVER_X });
  const planeScale = flight.interpolate({ inputRange: [0, 1], outputRange: [0.86, 1] });
  const planeOpacity = flight.interpolate({ inputRange: [0, 0.08, 1], outputRange: [0, 1, 1] });

  const floatY = float.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });

  return (
    <Pressable style={styles.container} onPress={goToApp}>
      <StatusBar style="dark" />

      <Animated.View style={[styles.logoStack, { transform: [{ translateY: floatY }] }]}>
        <Animated.Image
          source={require("../../assets/logo-wordmark-arc.png")}
          style={[styles.layer, { opacity: wordOpacity }]}
          resizeMode="contain"
        />

        {/* Sits above the trail but below the wordmark, so sliding it right reveals
            the trail without ever hiding a letter. Matches the screen background
            exactly, which is what makes the reveal invisible as a mechanism. */}
        <Animated.View
          style={[styles.cover, { transform: [{ translateX: coverTranslateX }] }]}
          pointerEvents="none"
        />

        <Animated.Image
          source={require("../../assets/logo-wordmark-navy.png")}
          style={[
            styles.layer,
            { opacity: wordOpacity, transform: [{ scale: wordScale }] },
          ]}
          resizeMode="contain"
        />

        <Animated.Image
          source={require("../../assets/logo-wordmark-plane.png")}
          style={[
            styles.layer,
            {
              opacity: planeOpacity,
              transform: [
                { translateX: planeTranslateX },
                { translateY: planeTranslateY },
                { translateX: PIVOT_X },
                { translateY: PIVOT_Y },
                { rotate: planeRotate },
                { scale: planeScale },
                { translateX: -PIVOT_X },
                { translateY: -PIVOT_Y },
              ],
            },
          ]}
          resizeMode="contain"
        />
      </Animated.View>

      <Animated.Text style={[styles.tagline, { opacity: taglineOpacity }]}>
        Every trip, on the map.
      </Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_CREAM,
    alignItems: "center",
    justifyContent: "center",
  },
  logoStack: {
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  layer: {
    position: "absolute",
    top: 0,
    left: 0,
    width: LOGO_WIDTH,
    height: LOGO_HEIGHT,
  },
  cover: {
    position: "absolute",
    top: -4,
    left: 0,
    width: LOGO_WIDTH + 40,
    height: LOGO_HEIGHT + 8,
    backgroundColor: BRAND_CREAM,
  },
  tagline: {
    marginTop: 10,
    color: BRAND_NAVY,
    fontSize: 14,
    fontWeight: "600",
    letterSpacing: 0.4,
  },
});
