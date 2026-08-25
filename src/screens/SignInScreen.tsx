import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Button from "../components/Button";
import ContentWidth from "../components/ContentWidth";
import { useLayoutMode } from "../context/LayoutModeContext";
import { useThemeColors } from "../context/ThemeContext";
import { WEB_TOP_NAV_HEIGHT } from "../navigation/WebTopNav";
import { SocialError, sendPasswordReset, signIn, signUp, validateUsername } from "../services/social";
import { ColorPalette } from "../theme/colors";

type Mode = "signIn" | "signUp";

/**
 * Sign in / create account.
 *
 * Reachable only from Friends — the map, trips and checklist all work signed out, and
 * an account is only needed for the social half. Gating the whole app behind a login
 * wall would be worse for the user and worse in review, since a reviewer would have
 * to create an account before seeing anything.
 */
export default function SignInScreen({ onDone }: { onDone?: () => void }) {
  const colors = useThemeColors();
  const styles = useMemo(() => createStyles(colors), [colors]);
  const { mode: layoutMode } = useLayoutMode();

  const [mode, setMode] = useState<Mode>("signUp");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const usernameOk = mode === "signIn" || validateUsername(username) !== null;
  const canSubmit =
    email.trim().length > 3 && password.length >= 8 && usernameOk && !busy;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === "signUp") {
        await signUp(email, password, username, displayName);
        Alert.alert(
          "Check your email",
          "We've sent you a link to confirm your address. Once you've tapped it, sign in here."
        );
        setMode("signIn");
      } else {
        await signIn(email, password);
        onDone?.();
      }
    } catch (e) {
      setError(e instanceof SocialError ? e.message : "Something went wrong. Try again.");
    } finally {
      setBusy(false);
    }
  };

  const forgotPassword = async () => {
    if (email.trim().length < 4) {
      setError("Enter your email address first.");
      return;
    }
    try {
      await sendPasswordReset(email);
      Alert.alert("Check your email", "We've sent you a link to reset your password.");
    } catch {
      setError("Couldn't send that right now. Try again in a moment.");
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[styles.content, layoutMode === "website" && styles.webContent]}
          keyboardShouldPersistTaps="handled"
        >
          <ContentWidth maxWidth={440}>
          <Image
            source={require("../../assets/logo-mark-transparent.png")}
            style={styles.mark}
            resizeMode="contain"
          />
          <Text style={styles.title}>
            {mode === "signUp" ? "Create your account" : "Welcome back"}
          </Text>
          <Text style={styles.subtitle}>
            An account is only needed to add friends and see their maps. Everything else
            works without one.
          </Text>

          {mode === "signUp" && (
            <>
              <Text style={styles.label}>Username</Text>
              <View style={styles.inputRow}>
                <Text style={styles.at}>@</Text>
                <TextInput
                  style={styles.rowInput}
                  value={username}
                  onChangeText={(t) => setUsername(t.replace(/[^a-zA-Z0-9_]/g, ""))}
                  placeholder="yourname"
                  placeholderTextColor={colors.textMuted}
                  autoCapitalize="none"
                  autoCorrect={false}
                  maxLength={20}
                />
              </View>
              <Text style={styles.hint}>
                {username.length === 0
                  ? "3–20 letters, numbers or underscores. This is how friends find you."
                  : usernameOk
                    ? "Looks good."
                    : "3–20 letters, numbers or underscores."}
              </Text>

              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Optional"
                placeholderTextColor={colors.textMuted}
                maxLength={40}
              />
            </>
          )}

          <Text style={styles.label}>Email</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            textContentType="emailAddress"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="At least 8 characters"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            autoCapitalize="none"
            textContentType={mode === "signUp" ? "newPassword" : "password"}
          />

          {!!error && (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle-outline" size={15} color={colors.danger} />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <View style={styles.submitWrap}>
            {busy ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <Button
                label={mode === "signUp" ? "Create account" : "Sign in"}
                onPress={submit}
                disabled={!canSubmit}
              />
            )}
          </View>

          {mode === "signIn" && (
            <Pressable onPress={forgotPassword} hitSlop={8} style={styles.linkWrap}>
              <Text style={styles.link}>Forgot your password?</Text>
            </Pressable>
          )}

          <Pressable
            onPress={() => {
              setMode(mode === "signUp" ? "signIn" : "signUp");
              setError(null);
            }}
            hitSlop={8}
            style={styles.linkWrap}
          >
            <Text style={styles.link}>
              {mode === "signUp" ? "I already have an account" : "Create an account instead"}
            </Text>
          </Pressable>
          </ContentWidth>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function createStyles(colors: ColorPalette) {
  return StyleSheet.create({
    safe: { flex: 1, backgroundColor: colors.bg },
    flex: { flex: 1 },
    content: { padding: 24, paddingBottom: 48 },
    webContent: { padding: 24, paddingTop: WEB_TOP_NAV_HEIGHT + 28, paddingBottom: 48 },
    mark: { width: 52, height: 52, alignSelf: "center", marginBottom: 14 },
    title: {
      color: colors.textPrimary,
      fontSize: 22,
      fontWeight: "800",
      textAlign: "center",
    },
    subtitle: {
      color: colors.textSecondary,
      fontSize: 13,
      lineHeight: 19,
      textAlign: "center",
      marginTop: 8,
      marginBottom: 8,
    },
    label: {
      color: colors.textSecondary,
      fontSize: 11,
      fontWeight: "700",
      textTransform: "uppercase",
      letterSpacing: 0.5,
      marginTop: 18,
      marginBottom: 6,
    },
    input: {
      color: colors.textPrimary,
      fontSize: 15,
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    inputRow: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: colors.card,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.cardBorder,
      paddingHorizontal: 12,
    },
    at: { color: colors.textMuted, fontSize: 15, marginRight: 2 },
    rowInput: { flex: 1, color: colors.textPrimary, fontSize: 15, paddingVertical: 11 },
    hint: { color: colors.textMuted, fontSize: 11, marginTop: 6, lineHeight: 16 },
    errorBox: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 18,
      padding: 10,
      borderRadius: 12,
      backgroundColor: colors.danger + "18",
    },
    errorText: { color: colors.danger, fontSize: 13, flex: 1, lineHeight: 18 },
    submitWrap: { marginTop: 24, minHeight: 48, justifyContent: "center" },
    linkWrap: { alignSelf: "center", paddingVertical: 10 },
    link: { color: colors.accent, fontSize: 13, fontWeight: "700" },
  });
}
