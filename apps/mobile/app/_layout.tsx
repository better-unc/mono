import FontAwesome from "@expo/vector-icons/FontAwesome";
import { DarkTheme, DefaultTheme, ThemeProvider } from "@react-navigation/native";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import "react-native-reanimated";
import "../global.css";

import { useColorScheme } from "@/components/useColorScheme";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryProvider } from "@/lib/query-client";
import { Text } from "react-native";

export { ErrorBoundary } from "expo-router";

export const unstable_settings = {
  initialRouteName: "(tabs)",
};

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  const colorScheme = useColorScheme();

  return (
    <QueryProvider>
      <SafeAreaProvider>
        <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
          <Stack>
            <Stack.Screen
              name="(auth)"
              options={{
                headerLargeTitle: true,
                headerTransparent: true,
                headerBackButtonDisplayMode: "minimal",
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerLargeTitle: true,
                headerTransparent: true,
                headerBackButtonDisplayMode: "minimal",
              }}
            />
            <Stack.Screen
              name="[username]"
              options={{
                headerLargeTitle: true,
                headerTransparent: true,
                headerBackButtonDisplayMode: "minimal",
              }}
            />
          </Stack>
        </ThemeProvider>
      </SafeAreaProvider>
    </QueryProvider>
  );
}
