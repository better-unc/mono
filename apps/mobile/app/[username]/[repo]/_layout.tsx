import { Stack } from "expo-router";

export default function RepoLayout() {
  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerBlurEffect: "systemMaterial",
        headerShadowVisible: false,
        headerStyle: {
          backgroundColor: "transparent",
        },
        headerTintColor: "#ffffff",
        contentStyle: {
          backgroundColor: "transparent",
        },
      }}
    >
      <Stack.Screen name="index" />
    </Stack>
  );
}
