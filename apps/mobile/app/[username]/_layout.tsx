import { Stack } from "expo-router";

export default function UserLayout() {
  return (
    <Stack
      screenOptions={{
        headerLargeTitle: true,
        headerTransparent: true,
        headerBackButtonDisplayMode: "minimal",
        title: "Profile",
        headerTitle: "Profile",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="[repo]/index" />
    </Stack>
  );
}
