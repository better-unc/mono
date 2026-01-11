import { View, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

type GradientBackgroundProps = {
  children: React.ReactNode;
  variant?: "default" | "auth" | "profile";
};

const gradients = {
  default: ["#0f0f23", "#1a1a3e", "#0d1b2a"],
  auth: ["#0a0a1a", "#1a0a2e", "#0a1a2e"],
  profile: ["#0d1117", "#161b22", "#0d1117"],
};

export function GradientBackground({ children, variant = "default" }: GradientBackgroundProps) {
  return <View style={styles.container}>{children}</View>;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
