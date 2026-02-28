import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useSession, signOut } from "@/lib/auth-client";
import { useUserRepositories, useUserProfile } from "@gitbruv/hooks";
import { useQueryClient } from "@tanstack/react-query";
import { UserAvatar } from "@/components/user-avatar";

export default function ProfileScreen() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  const user = session?.user as { name?: string; email?: string; username?: string; image?: string } | undefined;
  const { data: reposData, isLoading, refetch, isRefetching } = useUserRepositories(user?.username || "");
  const { data: profileData } = useUserProfile(user?.username || "");
  const avatarUrl = profileData?.avatarUrl;

  const repos = reposData?.repos || [];
  const handleRefresh = () => refetch();

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          queryClient.clear();
        },
      },
    ]);
  };

  if (isPending) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={{ flex: 1 }}>
        <View style={{ flex: 1 }} className="items-center justify-center px-6">
          <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 w-full max-w-[320px]">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <View className="w-20 h-20 bg-white/10 items-center justify-center mb-5">
                <FontAwesome name="user" size={40} color="rgba(255,255,255,0.5)" />
              </View>
              <Text className="text-white text-[22px] font-bold mb-2">Not signed in</Text>
              <Text className="text-white/50 text-sm text-center mb-6">Sign in to view your profile and repositories</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable className="py-3.5 px-8 overflow-hidden bg-blue-600/30">
                  <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                  <Text className="text-white font-semibold text-base relative z-10">Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-4">
          <View className="p-4 relative z-10">
            <View className="flex-row items-center">
              <UserAvatar avatarUrl={avatarUrl} size={56} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text className="text-white text-[17px] font-semibold">{user?.name}</Text>
                <Text className="text-white/60 text-[14px] mt-0.5">@{user?.username}</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-3 mt-2">
          <Text className="text-white text-base font-semibold">Your Repositories</Text>
          {repos.length > 0 && <Text className="text-white/40 text-xs">{repos.length}</Text>}
        </View>

        {isLoading ? (
          <View className="py-8">
            <ActivityIndicator size="small" color="#60a5fa" />
          </View>
        ) : repos.length === 0 ? (
          <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-4">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-6 items-center relative z-10">
              <FontAwesome name="inbox" size={28} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/40 text-sm mt-2 text-center">You haven't created any repositories yet</Text>
            </View>
          </View>
        ) : (
          repos.map((repo, index) => (
            <Link key={repo.id} href={`/${user?.username}/${repo.name}`} asChild>
              <Pressable className={index < repos.length - 1 ? "mb-2" : "mb-4"}>
                <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center p-3.5 relative z-10">
                    <View style={{ flex: 1 }} className="mr-3">
                      <View className="flex-row items-center mb-1">
                        <Text className="text-white text-[15px] font-semibold mr-2">{repo.name}</Text>
                        <View className={`px-1.5 py-0.5 ${repo.visibility === "private" ? "bg-yellow-500/20" : "bg-green-500/20"}`}>
                          <Text className={`text-[10px] font-semibold ${repo.visibility === "private" ? "text-yellow-400" : "text-green-500"}`}>
                            {repo.visibility}
                          </Text>
                        </View>
                      </View>
                      {repo.description && (
                        <Text className="text-white/50 text-[13px]" numberOfLines={1}>
                          {repo.description}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center bg-yellow-500/20 px-2 py-1">
                      <FontAwesome name="star" size={11} color="#fbbf24" />
                      <Text className="text-yellow-400 text-xs font-semibold ml-1">{repo.starCount}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))
        )}

        <Pressable onPress={handleSignOut} className="mt-4">
          <View className="overflow-hidden bg-red-500/15 border border-red-500/30">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center justify-center p-3.5 relative z-10">
              <FontAwesome name="sign-out" size={16} color="#f87171" />
              <Text className="text-red-400 font-semibold text-[15px] ml-2">Sign Out</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}
