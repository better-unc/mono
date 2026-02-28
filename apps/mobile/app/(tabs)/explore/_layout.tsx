import { Stack } from "expo-router";
import { useColorScheme } from "react-native";

export default function ExploreLayout() {
  const _colorScheme = useColorScheme();
  const _titleColor = _colorScheme === "dark" ? "#ffffff" : "#000000";

  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBackButtonDisplayMode: "minimal",
      }}
    >
      <Stack.Screen name="index" options={{ title: "Explore" }} />
    </Stack>
  );
}
