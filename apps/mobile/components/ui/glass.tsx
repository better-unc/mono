import { View, type ViewProps, Platform } from "react-native";
import {
  GlassView,
  GlassContainer,
  isLiquidGlassAvailable,
} from "expo-glass-effect";

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

export function GlassCard({
  children,
  style,
  glassStyle = "regular",
  interactive = false,
  tintColor,
  ...props
}: GlassCardProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View
        style={[
          {
            backgroundColor: "rgba(255, 255, 255, 0.1)",
            borderRadius: 20,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.2)",
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassView
      style={[{ borderRadius: 20 }, style]}
      glassEffectStyle={glassStyle}
      isInteractive={interactive}
      tintColor={tintColor}
      {...props}
    >
      {children}
    </GlassView>
  );
}

type GlassButtonProps = ViewProps & {
  interactive?: boolean;
  tintColor?: string;
};

export function GlassButton({
  children,
  style,
  interactive = true,
  tintColor,
  ...props
}: GlassButtonProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View
        style={[
          {
            backgroundColor: "rgba(255, 255, 255, 0.15)",
            borderRadius: 12,
            borderWidth: 1,
            borderColor: "rgba(255, 255, 255, 0.3)",
          },
          style,
        ]}
        {...props}
      >
        {children}
      </View>
    );
  }

  return (
    <GlassView
      style={[{ borderRadius: 12 }, style]}
      glassEffectStyle="clear"
      isInteractive={interactive}
      tintColor={tintColor}
      {...props}
    >
      {children}
    </GlassView>
  );
}

type GlassGroupProps = ViewProps & {
  spacing?: number;
};

export function GlassGroup({
  children,
  style,
  spacing = 8,
  ...props
}: GlassGroupProps) {
  const isAvailable = checkGlassAvailable();

  if (!isAvailable) {
    return (
      <View style={style} {...props}>
        {children}
      </View>
    );
  }

  return (
    <GlassContainer spacing={spacing} style={style} {...props}>
      {children}
    </GlassContainer>
  );
}

export function useGlassAvailable() {
  return checkGlassAvailable();
}
