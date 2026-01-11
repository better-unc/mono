import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSession, signOut } from "@/lib/auth-client";
import { useUserRepositories } from "@/lib/hooks/use-repository";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileScreen() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  const username = (session?.user as { username?: string })?.username || "";
  const { data: reposData, isLoading, refetch, isRefetching } = useUserRepositories(username);

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
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View className="flex-1">
        <View className="flex-1 items-center justify-center px-6">
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 w-full max-w-[320px]">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <View className="w-20 h-20 rounded-full bg-white/10 items-center justify-center mb-5">
                <FontAwesome name="user" size={40} color="rgba(255,255,255,0.5)" />
              </View>
              <Text className="text-white text-[22px] font-bold mb-2">Not signed in</Text>
              <Text className="text-white/50 text-sm text-center mb-6">Sign in to view your profile and repositories</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable className="py-3.5 px-8 rounded-xl overflow-hidden bg-blue-600/30">
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

  const user = session.user as { name?: string; email?: string; username?: string };

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-36"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-6 items-center relative z-10">
            <LinearGradient colors={["#8b5cf6", "#6366f1", "#3b82f6"]} className="w-20 h-20 rounded-full items-center justify-center mb-4" start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <FontAwesome name="user" size={36} color="#ffffff" />
            </LinearGradient>
            <Text className="text-white text-xl font-bold">{user.name}</Text>
            <Text className="text-white/50 text-[15px] mt-1">@{user.username}</Text>
            <Text className="text-white/30 text-[13px] mt-1">{user.email}</Text>
          </View>
        </View>

        <Text className="text-white text-lg font-semibold mb-4">Your Repositories</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color="#60a5fa" />
        ) : repos.length === 0 ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-4">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/40 text-sm mt-3 text-center">You haven't created any repositories yet</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${user.username}/${repo.name}`} asChild>
              <Pressable className="mb-3">
                <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center p-4 relative z-10">
                    <View className="flex-1 mr-3">
                      <View className="flex-row items-center">
                        <Text className="text-white text-[15px] font-semibold mr-2">{repo.name}</Text>
                        <View className={`px-2 py-0.5 rounded-lg ${repo.visibility === "private" ? "bg-yellow-500/20" : "bg-green-500/20"}`}>
                          <Text className={`text-[11px] font-semibold ${repo.visibility === "private" ? "text-yellow-400" : "text-green-500"}`}>{repo.visibility}</Text>
                        </View>
                      </View>
                      {repo.description && (
                        <Text className="text-white/50 text-[13px] mt-1" numberOfLines={1}>
                          {repo.description}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center bg-yellow-500/20 px-2.5 py-1.5 rounded-xl">
                      <FontAwesome name="star" size={12} color="#fbbf24" />
                      <Text className="text-yellow-400 text-xs font-semibold ml-1">{repo.starCount}</Text>
                    </View>
                  </View>
                </View>
              </Pressable>
            </Link>
          ))
        )}

        <Pressable onPress={handleSignOut} className="mt-2">
          <View className="rounded-2xl overflow-hidden bg-red-500/15 border border-red-500/30">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="flex-row items-center justify-center p-4 relative z-10">
              <FontAwesome name="sign-out" size={18} color="#f87171" />
              <Text className="text-red-400 font-semibold text-[15px] ml-2">Sign Out</Text>
            </View>
          </View>
        </Pressable>
      </ScrollView>
    </View>
  );
}

