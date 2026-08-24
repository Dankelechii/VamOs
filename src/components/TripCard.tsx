import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import Button from "./Button";
import MonthYearPicker from "./MonthYearPicker";
import PhotoGrid from "./PhotoGrid";
import { useThemeColors } from "../context/ThemeContext";
import { formatTripDates } from "../data/trips";
import { ColorPalette } from "../theme/colors";
import { Photo, Trip } from "../types";

/** One visit, as an editable card. Read-only when viewing a friend's map. */
export default function TripCard({
  trip,
  index,
  total,
  editable,
  contentWidth,
  onChange,
  onAddPhoto,
  onPressPhoto,
  onDelete,
}: {
  trip: Trip;
  /** 1-based position, newest first — used for the "Trip 2 of 3" heading. */
  index: number;
  total: number;
  editable: boolean;
  contentWidth: number;
  onChange: (patch: Partial<Trip>) => void;
  onAddPhoto: () => void;
  onPressPhoto: (photo: Photo) => void;
  onDelete: () => void;
}) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);

  const [titleDraft, setTitleDraft] = useState(trip.title ?? "");
  const [notesDraft, setNotesDraft] = useState(trip.notes ?? "");
  const [picking, setPicking] = useState<"start" | "end" | null>(null);

  // Trips can be reordered by a date edit, so a card can be handed a different trip
  // than it rendered last time — resync the drafts when that happens.
  useEffect(() => {
    setTitleDraft(trip.title ?? "");
    setNotesDraft(trip.notes ?? "");
  }, [trip.id]);

  const heading = total > 1 ? `Trip ${total - index + 1} of ${total}` : "Trip";

  return (
    <View style={styles.card}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>{heading}</Text>
        {editable && (
          <Pressable onPress={onDelete} hitSlop={10}>
            <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {editable ? (
        <TextInput
          style={styles.titleInput}
          value={titleDraft}
          onChangeText={setTitleDraft}
          onBlur={() => onChange({ title: titleDraft.trim() || undefined })}
          placeholder="Name this trip (optional)"
          placeholderTextColor={colors.textMuted}
        />
      ) : trip.title ? (
        <Text style={styles.titleReadOnly}>{trip.title}</Text>
      ) : null}

      {editable ? (
        <View style={styles.dateRow}>
          <Pressable
            testID={`trip-start-${trip.id}`}
            style={styles.dateChip}
            onPress={() => setPicking("start")}
          >
            <Ionicons name="calendar-outline" size={13} color={colors.accent} />
            <Text style={styles.dateChipText}>
              {trip.startDate ? formatTripDates({ ...trip, endDate: undefined }) : "Start"}
            </Text>
          </Pressable>
          <Text style={styles.dateDash}>→</Text>
          <Pressable
            testID={`trip-end-${trip.id}`}
            style={styles.dateChip}
            onPress={() => setPicking("end")}
          >
            <Ionicons name="calendar-outline" size={13} color={colors.accent} />
            <Text style={styles.dateChipText}>
              {trip.endDate ? formatTripDates({ ...trip, startDate: trip.endDate, endDate: undefined }) : "End"}
            </Text>
          </Pressable>
        </View>
      ) : (
        <Text style={styles.dateReadOnly}>{formatTripDates(trip)}</Text>
      )}

      {editable ? (
        <TextInput
          style={styles.notesInput}
          value={notesDraft}
          onChangeText={setNotesDraft}
          onBlur={() => onChange({ notes: notesDraft.trim() || undefined })}
          placeholder="What happened on this trip?"
          placeholderTextColor={colors.textMuted}
          multiline
        />
      ) : trip.notes ? (
        <Text style={styles.notesReadOnly}>{trip.notes}</Text>
      ) : null}

      <View style={styles.photosHeader}>
        <Text style={styles.photosLabel}>
          {trip.photos.length} photo{trip.photos.length === 1 ? "" : "s"}
        </Text>
        {editable && (
          <Pressable onPress={onAddPhoto} hitSlop={8}>
            <Text style={styles.addPhotoText}>+ Add photo</Text>
          </Pressable>
        )}
      </View>
      <PhotoGrid
        photos={trip.photos}
        onPressPhoto={onPressPhoto}
        availableWidth={contentWidth}
        cornerRadius={8}
        emptyLabel={editable ? "No photos from this trip yet" : "No photos"}
      />

      <MonthYearPicker
        visible={picking !== null}
        title={picking === "end" ? "Trip ended" : "Trip started"}
        value={picking === "end" ? trip.endDate : trip.startDate}
        minValue={picking === "end" ? trip.startDate : undefined}
        onClose={() => setPicking(null)}
        onSelect={(iso) => {
          if (picking === "end") {
            onChange({ endDate: iso ?? undefined });
          } else {
            // Moving the start past the end would leave an impossible range.
            const patch: Partial<Trip> = { startDate: iso ?? undefined };
            if (iso && trip.endDate && trip.endDate < iso) patch.endDate = undefined;
            onChange(patch);
          }
        }}
      />
    </View>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    card: {
      backgroundColor: colors.card,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 14,
      marginBottom: 14,
    },
    headerRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 6,
    },
    heading: {
      color: colors.textMuted,
      fontSize: 11,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.7,
    },
    titleInput: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
      paddingVertical: 2,
      marginBottom: 8,
    },
    titleReadOnly: {
      color: colors.textPrimary,
      fontSize: 17,
      fontWeight: "700",
      marginBottom: 8,
    },
    dateRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
    dateChip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      backgroundColor: colors.bgElevated,
    },
    dateChipText: { color: colors.accent, fontSize: 12, fontWeight: "700" },
    dateDash: { color: colors.textMuted, fontSize: 13 },
    dateReadOnly: { color: colors.accent, fontSize: 13, fontWeight: "700", marginBottom: 12 },
    notesInput: {
      color: colors.textPrimary,
      fontSize: 14,
      minHeight: 52,
      backgroundColor: colors.bgElevated,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      padding: 10,
      textAlignVertical: "top",
      marginBottom: 12,
    },
    notesReadOnly: { color: colors.textPrimary, fontSize: 14, lineHeight: 20, marginBottom: 12 },
    photosHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 8,
    },
    photosLabel: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
    },
    addPhotoText: { color: colors.accent, fontWeight: "700", fontSize: 13 },
  });
}
