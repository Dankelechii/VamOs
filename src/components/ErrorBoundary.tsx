import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { BRAND_CREAM, BRAND_NAVY } from "../theme/colors";

interface State {
  error: Error | null;
}

/**
 * Catches render errors so a crash shows something branded and recoverable instead
 * of a white screen.
 *
 * Deliberately outside the theme system and using no hooks or context: whatever
 * threw might be the theme provider itself, so this has to stand on its own. That's
 * why the colours are the fixed brand constants rather than `useThemeColors()`.
 *
 * "Try again" remounts the tree by changing the child key. Saved data lives in
 * AsyncStorage, so a remount recovers the user's map rather than losing it — which
 * makes retrying worth offering rather than just apologising.
 */
export default class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State & { resetKey: number }
> {
  state = { error: null as Error | null, resetKey: 0 };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // No crash reporter wired up yet; this at least surfaces it in device logs.
    console.error("VamOs crashed:", error);
  }

  handleRetry = () => {
    this.setState((s) => ({ error: null, resetKey: s.resetKey + 1 }));
  };

  render() {
    if (this.state.error) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.body}>
            Your map is saved on this device — nothing has been lost. Try again, and if it
            keeps happening, reopening the app usually clears it.
          </Text>
          <Pressable style={styles.button} onPress={this.handleRetry}>
            <Text style={styles.buttonLabel}>Try again</Text>
          </Pressable>
        </View>
      );
    }

    return <React.Fragment key={this.state.resetKey}>{this.props.children}</React.Fragment>;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: BRAND_CREAM,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
  },
  title: { color: BRAND_NAVY, fontSize: 20, fontWeight: "800", marginBottom: 10 },
  body: {
    color: BRAND_NAVY,
    opacity: 0.75,
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    marginBottom: 24,
  },
  button: {
    backgroundColor: BRAND_NAVY,
    paddingHorizontal: 26,
    paddingVertical: 12,
    borderRadius: 999,
  },
  buttonLabel: { color: BRAND_CREAM, fontSize: 15, fontWeight: "700" },
});
