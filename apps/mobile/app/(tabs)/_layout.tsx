import { Platform, DynamicColorIOS } from "react-native";
import {
  NativeTabs,
  Icon,
  Label,
} from "expo-router/unstable-native-tabs";

export default function TabLayout() {
  return (
    <NativeTabs
      minimizeBehavior="onScrollDown"
      labelStyle={Platform.select({
        ios: {
          color: DynamicColorIOS({
            dark: "white",
            light: "black",
          }),
        },
        default: undefined,
      })}
      tintColor={Platform.select({
        ios: DynamicColorIOS({
          dark: "white",
          light: "black",
        }),
        default: undefined,
      })}
    >
      <NativeTabs.Trigger name="home">
        <Icon
          sf={{ default: "house", selected: "house.fill" }}
          drawable="ic_home"
        />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="explore">
        <Icon
          sf={{ default: "safari", selected: "safari.fill" }}
          drawable="ic_search"
        />
        <Label>Explore</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <Icon
          sf={{ default: "person", selected: "person.fill" }}
          drawable="ic_person"
        />
        <Label>Profile</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
