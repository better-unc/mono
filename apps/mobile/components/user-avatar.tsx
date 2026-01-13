import { View, Image, ImageStyle, ViewStyle } from "react-native";
import FontAwesome from "@expo/vector-icons/FontAwesome";

type UserAvatarProps = {
  avatarUrl?: string | null;
  size?: number;
  fallbackColor?: string;
  fallbackIconColor?: string;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
};

const API_URL = process.env.EXPO_PUBLIC_API_URL || "http://localhost:3001";

export function UserAvatar({
  avatarUrl,
  size = 40,
  fallbackColor = "rgba(96, 165, 250, 0.2)",
  fallbackIconColor = "#60a5fa",
  style,
  imageStyle,
}: UserAvatarProps) {
  const iconSize = Math.round(size * 0.5);

  console.log("avatarUrl", avatarUrl);

  if (avatarUrl) {
    return (
      <Image source={{ uri: `${API_URL}${avatarUrl}` }} style={[{ width: size, height: size, borderRadius: size / 2 }, imageStyle, style as ImageStyle]} />
    );
  }

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fallbackColor,
          alignItems: "center",
          justifyContent: "center",
        },
        style,
      ]}
    >
      <FontAwesome name="user" size={iconSize} color={fallbackIconColor} />
    </View>
  );
}
