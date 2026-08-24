import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Dimensions, Pressable, StyleSheet, Text, View } from "react-native";
import {
  HandlerStateChangeEvent,
  PanGestureHandler,
  PanGestureHandlerEventPayload,
  PinchGestureHandler,
  PinchGestureHandlerEventPayload,
  State,
} from "react-native-gesture-handler";
import Svg, { Circle, G, Path } from "react-native-svg";
import { useThemeColors } from "../context/ThemeContext";
import { MAP_VIEWBOX, WORLD_COUNTRIES } from "../data/worldCountries";
import { ColorPalette } from "../theme/colors";

const MIN_SCALE = 1;
const MAX_SCALE = 7;

// A classic teardrop map-pin, drawn with its tip at the local origin (0,0) pointing
// down, body extending upward — sized in viewBox units (the map is 1000x520).
const PIN_PATH = "M0,0 C-1.5,-7 -10,-10 -10,-20 A10,10 0 1 1 10,-20 C10,-10 1.5,-7 0,0 Z";
const PIN_DROP_DISTANCE = 90; // how far above its resting spot the pin starts, in viewBox units

const AnimatedG = Animated.createAnimatedComponent(G);

interface Props {
  visitedIds: Set<string>;
  onSelectCountry: (id: string) => void;
  selectedId?: string | null;
  visitedColor?: string;
  height?: number;
}

export default function WorldMapSvg({
  visitedIds,
  onSelectCountry,
  selectedId,
  visitedColor,
  height,
}: Props) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const screenWidth = Dimensions.get("window").width;
  const mapWidth = screenWidth;
  const mapHeight = height ?? (mapWidth * MAP_VIEWBOX.height) / MAP_VIEWBOX.width;

  const baseScale = useRef(new Animated.Value(1)).current;
  const pinchScale = useRef(new Animated.Value(1)).current;
  const baseX = useRef(new Animated.Value(0)).current;
  const panX = useRef(new Animated.Value(0)).current;
  const baseY = useRef(new Animated.Value(0)).current;
  const panY = useRef(new Animated.Value(0)).current;

  const scale = Animated.multiply(baseScale, pinchScale);
  const translateX = Animated.add(baseX, panX);
  const translateY = Animated.add(baseY, panY);

  const scaleRef = useRef(1);
  const pinchFactorRef = useRef(1);
  const xRef = useRef(0);
  const panDeltaRef = useRef(0);
  const yRef = useRef(0);
  const panDeltaYRef = useRef(0);

  const pinchHandlerRef = useRef(null);
  const panHandlerRef = useRef(null);

  useEffect(() => {
    const idScale = baseScale.addListener(({ value }) => (scaleRef.current = value));
    const idPinch = pinchScale.addListener(({ value }) => (pinchFactorRef.current = value));
    const idX = baseX.addListener(({ value }) => (xRef.current = value));
    const idPanX = panX.addListener(({ value }) => (panDeltaRef.current = value));
    const idY = baseY.addListener(({ value }) => (yRef.current = value));
    const idPanY = panY.addListener(({ value }) => (panDeltaYRef.current = value));
    return () => {
      baseScale.removeListener(idScale);
      pinchScale.removeListener(idPinch);
      baseX.removeListener(idX);
      panX.removeListener(idPanX);
      baseY.removeListener(idY);
      panY.removeListener(idPanY);
    };
  }, []);

  const onPinchGestureEvent = Animated.event(
    [{ nativeEvent: { scale: pinchScale } }],
    { useNativeDriver: true }
  );

  const onPanGestureEvent = Animated.event(
    [{ nativeEvent: { translationX: panX, translationY: panY } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: HandlerStateChangeEvent<PinchGestureHandlerEventPayload>) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      const next = Math.min(MAX_SCALE, Math.max(MIN_SCALE, scaleRef.current * pinchFactorRef.current));
      baseScale.setValue(next);
      pinchScale.setValue(1);
    }
  };

  const onPanStateChange = (event: HandlerStateChangeEvent<PanGestureHandlerEventPayload>) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      baseX.setValue(xRef.current + panDeltaRef.current);
      panX.setValue(0);
      baseY.setValue(yRef.current + panDeltaYRef.current);
      panY.setValue(0);
    }
  };

  const resetView = () => {
    Animated.parallel([
      Animated.timing(baseScale, { toValue: 1, duration: 220, useNativeDriver: true }),
      Animated.timing(baseX, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(baseY, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start();
  };

  const [showReset, setShowReset] = useState(false);
  useEffect(() => {
    const id = baseScale.addListener(({ value }) => setShowReset(value > 1.05));
    return () => baseScale.removeListener(id);
  }, []);

  // Animated pin drop: whenever the selected country changes, drop a pin onto it
  // with a small bounce, fading in as it lands.
  const pinDrop = useRef(new Animated.Value(0)).current; // 0 = above, 1 = resting (may overshoot)
  const pinOpacity = useRef(new Animated.Value(0)).current;
  const selectedCountry = useMemo(
    () => (selectedId ? WORLD_COUNTRIES.find((c) => c.id === selectedId) ?? null : null),
    [selectedId]
  );

  useEffect(() => {
    if (!selectedCountry) return;
    pinDrop.setValue(0);
    pinOpacity.setValue(0);
    Animated.parallel([
      Animated.spring(pinDrop, {
        toValue: 1,
        friction: 4.5,
        tension: 55,
        useNativeDriver: false,
      }),
      Animated.timing(pinOpacity, { toValue: 1, duration: 150, useNativeDriver: false }),
    ]).start();
  }, [selectedId]);

  // Interpolate straight to a full "translate(x, y)" transform string (baking in the
  // selected country's centroid) rather than a `transform={[{translateX}, {translateY}]}`
  // array mixing a plain number with an Animated value — react-native-svg's web
  // renderer can serialize that array form as "[object Object]" in the <g transform>
  // attribute instead of a resolved number. A single interpolated string sidesteps it.
  const pinTransform = pinDrop.interpolate({
    inputRange: [0, 1],
    outputRange: [
      `translate(${selectedCountry?.cx ?? 0}, ${(selectedCountry?.cy ?? 0) - PIN_DROP_DISTANCE})`,
      `translate(${selectedCountry?.cx ?? 0}, ${selectedCountry?.cy ?? 0})`,
    ],
  });

  return (
    <View style={[styles.wrapper, { width: mapWidth, height: mapHeight }]}>
      <PanGestureHandler
        ref={panHandlerRef}
        simultaneousHandlers={pinchHandlerRef}
        minDist={8}
        onGestureEvent={onPanGestureEvent}
        onHandlerStateChange={onPanStateChange}
      >
        <Animated.View style={StyleSheet.absoluteFill}>
          <PinchGestureHandler
            ref={pinchHandlerRef}
            simultaneousHandlers={panHandlerRef}
            onGestureEvent={onPinchGestureEvent}
            onHandlerStateChange={onPinchStateChange}
          >
            <Animated.View
              style={[
                StyleSheet.absoluteFill,
                {
                  transform: [{ translateX }, { translateY }, { scale }],
                },
              ]}
            >
              <Svg
                width={mapWidth}
                height={mapHeight}
                viewBox={`0 0 ${MAP_VIEWBOX.width} ${MAP_VIEWBOX.height}`}
              >
                {WORLD_COUNTRIES.map((c) => {
                  const visited = visitedIds.has(c.id);
                  const isSelected = selectedId === c.id;
                  return (
                    <Path
                      key={c.id}
                      d={c.path}
                      fill={visited ? visitedColor ?? colors.visited : colors.unvisited}
                      // Selection uses `visitedSelected`, not the accent: now that a
                      // filled-in country is itself the accent gold, a gold outline on
                      // a gold fill is invisible.
                      stroke={
                        isSelected
                          ? colors.visitedSelected
                          : visited
                            ? colors.visitedStroke
                            : colors.unvisitedStroke
                      }
                      strokeWidth={isSelected ? 1.6 : 0.6}
                      onPress={() => onSelectCountry(c.id)}
                    />
                  );
                })}
                {selectedCountry && (
                  <AnimatedG
                    opacity={pinOpacity}
                    transform={pinTransform as unknown as string}
                  >
                    {/* Ink-on-ground rather than gold, for the same reason as the
                        selected stroke: the pin lands on a gold country. */}
                    <Path d={PIN_PATH} fill={colors.textPrimary} stroke={colors.bg} strokeWidth={1.4} />
                    <Circle cx={0} cy={-20} r={3.6} fill={colors.bg} />
                  </AnimatedG>
                )}
              </Svg>
            </Animated.View>
          </PinchGestureHandler>
        </Animated.View>
      </PanGestureHandler>
      {showReset && (
        <Pressable style={styles.resetButton} onPress={resetView} hitSlop={10}>
          <Text style={styles.resetButtonText}>Reset view</Text>
        </Pressable>
      )}
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    wrapper: {
      overflow: "hidden",
      backgroundColor: colors.ocean,
    },
    resetButton: {
      position: "absolute",
      right: 12,
      bottom: 12,
      backgroundColor: colors.card,
      borderColor: colors.cardBorder,
      borderWidth: 1,
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 20,
    },
    resetButtonText: {
      color: colors.textSecondary,
      fontSize: 12,
      fontWeight: "600",
    },
  });
}
