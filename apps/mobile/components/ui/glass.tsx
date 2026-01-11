import { View, type ViewProps, Platform, StyleSheet } from "react-native";
import { GlassView, GlassContainer, isLiquidGlassAvailable } from "expo-glass-effect";
import { BlurView } from "expo-blur";

function checkGlassAvailable(): boolean {
  if (Platform.OS !== "ios") return false;
  try {
    return isLiquidGlassAvailable();
  } catch {
    return false;
  }
}

type GlassCardProps = ViewProps & {
  glassStyle?: "regular" | "clear";
  interactive?: boolean;
  tintColor?: string;
};

export function GlassCard({ children, style, className, glassStyle = "regular", interactive = false, tintColor, ...props }: GlassCardProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View style={[styles.cardFallback, style]} className={className} {...props}>
        <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.cardContent}>{children}</View>
      </View>
    );
  }

  return (
    <GlassView style={[styles.card, style]} glassEffectStyle={glassStyle} isInteractive={interactive} tintColor={tintColor} {...props}>
      <View className={className}>{children}</View>
    </GlassView>
  );
}

type GlassButtonProps = ViewProps & {
  interactive?: boolean;
  tintColor?: string;
};

export function GlassButton({ children, style, className, interactive = true, tintColor, ...props }: GlassButtonProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View style={[styles.buttonFallback, style]} className={className} {...props}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={styles.buttonContent}>{children}</View>
      </View>
    );
  }

  return (
    <GlassView style={[styles.button, style]} glassEffectStyle="clear" isInteractive={interactive} tintColor={tintColor} {...props}>
      <View className={className}>{children}</View>
    </GlassView>
  );
}

type GlassGroupProps = ViewProps & {
  spacing?: number;
};

export function GlassGroup({ children, style, className, spacing = 8, ...props }: GlassGroupProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View style={style} className={className} {...props}>
        {children}
      </View>
    );
  }

  return (
    <GlassContainer spacing={spacing} style={style} className={className} {...props}>
      {children}
    </GlassContainer>
  );
}

export function useGlassAvailable() {
  return checkGlassAvailable();
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
  },
  cardFallback: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.8)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardContent: {
    position: "relative",
    zIndex: 1,
  },
  button: {
    borderRadius: 12,
    overflow: "hidden",
  },
  buttonFallback: {
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(60, 60, 90, 0.6)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.15)",
  },
  buttonContent: {
    position: "relative",
    zIndex: 1,
  },
});
