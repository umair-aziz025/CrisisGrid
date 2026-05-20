import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { ColorPalette, radius, spacing, typography } from "@/theme";
import { useTheme } from "@/theme/ThemeProvider";
import { Button } from "@/components/ui/Button";

type Props = { children: React.ReactNode };
type State = { error: Error | null };

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    if (__DEV__) {
      console.error("ErrorBoundary caught:", error, info);
    }
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return <Fallback message={this.state.error.message} onReset={this.reset} />;
    }
    return this.props.children;
  }
}

function Fallback({ message, onReset }: { message: string; onReset: () => void }) {
  const { palette } = useTheme();
  const styles = makeStyles(palette);
  return (
    <View style={styles.root}>
      <View style={styles.icon}>
        <AlertTriangle size={36} color={palette.destructive} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.body}>
        {message || "An unexpected error occurred. Please try again."}
      </Text>
      <Button title="Try Again" onPress={onReset} fullWidth={false} />
    </View>
  );
}

const makeStyles = (c: ColorPalette) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: c.background,
      alignItems: "center",
      justifyContent: "center",
      padding: spacing.xl,
      gap: spacing.md,
    },
    icon: {
      width: 72,
      height: 72,
      borderRadius: radius.pill,
      backgroundColor: "rgba(242, 59, 59, 0.15)",
      alignItems: "center",
      justifyContent: "center",
    },
    title: { ...typography.h2, color: c.foreground, textAlign: "center" },
    body: { ...typography.body, color: c.mutedForeground, textAlign: "center" },
  });
