import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useUserProfile } from "@/lib/hooks/use-user";
import { useUserRepositories } from "@/lib/hooks/use-repository";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const { data: user, isLoading: userLoading, error: userError, refetch: refetchUser, isRefetching: isRefetchingUser } = useUserProfile(username || "");
  const { data: reposData, isLoading: reposLoading, refetch: refetchRepos, isRefetching: isRefetchingRepos } = useUserRepositories(username || "");

  const repos = reposData?.repos || [];
  const isLoading = userLoading || reposLoading;
  const isRefetching = isRefetchingUser || isRefetchingRepos;

  const handleRefresh = () => {
    refetchUser();
    refetchRepos();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "", headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (userError || !user) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Stack.Screen options={{ title: "Error" }} />
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-8 items-center relative z-10">
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text className="text-red-400 text-base mt-4">{userError?.message || "User not found"}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1">
      <Stack.Screen
        options={{ title: user.username, headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-10"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-6 items-center relative z-10">
            <LinearGradient colors={["#a78bfa", "#8b5cf6", "#6366f1"]} className="w-[88px] h-[88px] rounded-full items-center justify-center mb-4">
              <FontAwesome name="user" size={40} color="#ffffff" />
            </LinearGradient>
            <Text className="text-white text-2xl font-bold">{user.name}</Text>
            <Text className="text-white/50 text-base mt-1">@{user.username}</Text>
            {user.bio && <Text className="text-white/60 text-sm text-center mt-4 leading-5 px-2">{user.bio}</Text>}

            {(user.location || user.website) && (
              <View className="flex-row flex-wrap justify-center mt-4">
                {user.location && (
                  <View className="flex-row items-center mr-4">
                    <View className="w-6 h-6 rounded-full bg-blue-500/20 items-center justify-center mr-2">
                      <FontAwesome name="map-marker" size={12} color="#60a5fa" />
                    </View>
                    <Text className="text-white/50 text-[13px]">{user.location}</Text>
                  </View>
                )}
                {user.website && (
                  <View className="flex-row items-center">
                    <View className="w-6 h-6 rounded-full bg-blue-500/20 items-center justify-center mr-2">
                      <FontAwesome name="link" size={12} color="#60a5fa" />
                    </View>
                    <Text className="text-blue-400 text-[13px]">{user.website}</Text>
                  </View>
                )}
              </View>
            )}

            <View className="flex-row mt-5 pt-5 border-t border-white/10">
              <View className="items-center px-6">
                <Text className="text-white text-xl font-bold">{repos.length}</Text>
                <Text className="text-white/40 text-xs mt-0.5">Repositories</Text>
              </View>
            </View>
          </View>
        </View>

        <Text className="text-white text-lg font-semibold mb-4">Repositories</Text>

        {repos.length === 0 ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/40 text-sm mt-3">No public repositories</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${username}/${repo.name}`} asChild>
              <Pressable className="mb-3">
                <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center p-4 relative z-10">
                    <View className="w-9 h-9 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                      <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                    </View>
                    <View className="flex-1 mr-3">
                      <Text className="text-white text-[15px] font-semibold">{repo.name}</Text>
                      {repo.description && (
                        <Text className="text-white/50 text-[13px] mt-1" numberOfLines={2}>
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
      </ScrollView>
    </View>
  );
}

