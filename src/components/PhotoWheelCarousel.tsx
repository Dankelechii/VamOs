import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import CountryGhostFrame from "./CountryGhostFrame";
import { useThemeColors } from "../context/ThemeContext";
import { getCountryById } from "../data/countryLookup";
import { ColorPalette } from "../theme/colors";
import { Photo } from "../types";

export interface PhotoWheelItem {
  photo: Photo;
  countryId: string;
}

// The card *is* the frame: the country silhouette is drawn at full card size and the
// photo sits inset on top of it, so the outline reads as a border around the picture.
const CARD_WIDTH = 152;
const FRAME_HEIGHT = 178;   // the zone the country outline is drawn in
const LABEL_HEIGHT = 20;    // kept clear of the outline so the caption stays readable
const CARD_HEIGHT = FRAME_HEIGHT + LABEL_HEIGHT;
// The photo sits well inside the frame zone so the country outline behind it stays
// visible on every side — that gap *is* the frame. Shrinking the photo is what
// creates it; the outline itself can't overflow (see CountryGhostFrame).
const PHOTO_WIDTH = 94;
const PHOTO_HEIGHT = 120;
// Centers are closer together than the card is wide, so neighboring cards
// overlap and fan out — the "wheel" / coverflow feel.
const ITEM_SPACING = 104;

export default function PhotoWheelCarousel({
  items,
  onPressPhoto,
}: {
  items: PhotoWheelItem[];
  onPressPhoto?: (photo: Photo) => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { width } = useWindowDimensions();
  const sidePadding = (width - CARD_WIDTH) / 2;

  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<Animated.AnimatedComponent<any> & { scrollTo: (opts: { x: number; animated?: boolean }) => void }>(null);
  const [centerIndex, setCenterIndex] = useState(0);

  useEffect(() => {
    const id = scrollX.addListener(({ value }) => {
      const idx = Math.round(value / ITEM_SPACING);
      setCenterIndex((prev) => (prev === idx ? prev : idx));
    });
    return () => scrollX.removeListener(id);
  }, [scrollX]);

  if (items.length === 0) {
    return (
      <View style={styles.empty}>
        <View style={styles.emptyIconCircle} />
        <Text style={styles.emptyText}>Your trip photos will spin up here</Text>
      </View>
    );
  }

  return (
    <Animated.ScrollView
      ref={scrollRef as any}
      horizontal
      showsHorizontalScrollIndicator={false}
      decelerationRate="fast"
      snapToInterval={ITEM_SPACING}
      snapToAlignment="start"
      contentContainerStyle={{ paddingHorizontal: sidePadding, alignItems: "center" }}
      onScroll={Animated.event([{ nativeEvent: { contentOffset: { x: scrollX } } }], {
        useNativeDriver: true,
      })}
      scrollEventThrottle={16}
    >
      {items.map(({ photo, countryId }, index) => {
        const center = index * ITEM_SPACING;
        const inputRange = [
          center - 2 * ITEM_SPACING,
          center - ITEM_SPACING,
          center,
          center + ITEM_SPACING,
          center + 2 * ITEM_SPACING,
        ];

        const scale = scrollX.interpolate({
          inputRange,
          outputRange: [0.7, 0.84, 1, 0.84, 0.7],
          extrapolate: "clamp",
        });
        const rotateY = scrollX.interpolate({
          inputRange,
          outputRange: ["48deg", "26deg", "0deg", "-26deg", "-48deg"],
          extrapolate: "clamp",
        });
        const translateY = scrollX.interpolate({
          inputRange,
          outputRange: [26, 12, 0, 12, 26],
          extrapolate: "clamp",
        });
        const opacity = scrollX.interpolate({
          inputRange,
          outputRange: [0.4, 0.72, 1, 0.72, 0.4],
          extrapolate: "clamp",
        });

        const country = getCountryById(countryId);

        return (
          <Animated.View
            key={photo.id}
            style={[
              styles.cardWrap,
              {
                width: CARD_WIDTH,
                marginRight: ITEM_SPACING - CARD_WIDTH,
                zIndex: index === centerIndex ? 10 : 1,
                opacity,
                transform: [
                  { perspective: 900 },
                  { scale },
                  { rotateY },
                  { translateY },
                ],
              },
            ]}
          >
            <View style={styles.frameZone}>
              <CountryGhostFrame
                countryId={countryId}
                width={CARD_WIDTH}
                height={FRAME_HEIGHT}
                color={colors.accent}
              />
              <Pressable
                onPress={() => {
                  scrollRef.current?.scrollTo({ x: center, animated: true });
                  onPressPhoto?.(photo);
                }}
                style={styles.photo}
              >
                <Image source={{ uri: photo.uri }} style={styles.image} />
              </Pressable>
            </View>
            {country && (
              <Text style={styles.countryLabel} numberOfLines={1}>
                {country.name}
              </Text>
            )}
          </Animated.View>
        );
      })}
    </Animated.ScrollView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    cardWrap: {
      height: CARD_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    frameZone: {
      width: CARD_WIDTH,
      height: FRAME_HEIGHT,
      alignItems: "center",
      justifyContent: "center",
    },
    photo: {
      width: PHOTO_WIDTH,
      height: PHOTO_HEIGHT,
      borderRadius: 12,
      overflow: "hidden",
      backgroundColor: colors.card,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      shadowColor: "#000",
      shadowOpacity: 0.18,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
    },
    image: { width: "100%", height: "100%" },
    countryLabel: {
      height: LABEL_HEIGHT,
      lineHeight: LABEL_HEIGHT,
      maxWidth: CARD_WIDTH - 8,
      color: colors.accent,
      fontSize: 10,
      fontWeight: "700",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      textAlign: "center",
    },
    empty: {
      paddingVertical: 40,
      alignItems: "center",
      justifyContent: "center",
    },
    emptyIconCircle: {
      width: 56,
      height: 56,
      borderRadius: 28,
      borderWidth: 2,
      borderColor: colors.cardBorder,
      marginBottom: 10,
    },
    emptyText: { color: colors.textMuted, fontSize: 12 },
  });
}
