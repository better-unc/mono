import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useUserProfile, useUserRepositories } from "@gitbruv/hooks";
import { formatDistanceToNow } from "date-fns";
import { UserAvatar } from "@/components/user-avatar";

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
      <View style={{ flex: 1 }} className="items-center justify-center">
        <Stack.Screen options={{ title: "", headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (userError || !user) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center px-6">
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
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: user.username, headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-4">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-4 relative z-10">
            <View className="flex-row items-start mb-4">
              <UserAvatar avatarUrl={user.avatarUrl} size={64} style={{ marginRight: 12 }} />
              <View style={{ flex: 1 }}>
                <Text className="text-white text-[18px] font-semibold">{user.name}</Text>
                <Text className="text-white/60 text-[14px] mt-0.5">@{user.username}</Text>
                {user.pronouns && <Text className="text-white/40 text-[12px] mt-0.5">{user.pronouns}</Text>}
              </View>
            </View>

            {user.bio && <Text className="text-white/80 text-[14px] leading-5 mb-3">{user.bio}</Text>}

            <View className="flex-row flex-wrap gap-3 mb-3">
              {user.location && (
                <View className="flex-row items-center">
                  <FontAwesome name="map-marker" size={12} color="#60a5fa" />
                  <Text className="text-white/60 text-[13px] ml-1.5">{user.location}</Text>
                </View>
              )}
              {user.website && (
                <View className="flex-row items-center">
                  <FontAwesome name="link" size={12} color="#60a5fa" />
                  <Text className="text-blue-400 text-[13px] ml-1.5">{user.website}</Text>
                </View>
              )}
              {user.createdAt && (
                <View className="flex-row items-center">
                  <FontAwesome name="calendar" size={12} color="#60a5fa" />
                  <Text className="text-white/60 text-[13px] ml-1.5">Joined {formatDistanceToNow(new Date(user.createdAt), { addSuffix: true })}</Text>
                </View>
              )}
            </View>

            <View className="flex-row pt-3 border-t border-white/10">
              <View className="flex-row items-center mr-6">
                <FontAwesome name="code-fork" size={14} color="#60a5fa" />
                <Text className="text-white text-[16px] font-semibold ml-2">{repos.length}</Text>
                <Text className="text-white/50 text-[13px] ml-1">repositories</Text>
              </View>
            </View>
          </View>
        </View>

        <View className="flex-row items-center justify-between mb-3">
          <Text className="text-white text-base font-semibold">Repositories</Text>
          {repos.length > 0 && <Text className="text-white/40 text-xs">{repos.length}</Text>}
        </View>

        {repos.length === 0 ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-6 items-center relative z-10">
              <FontAwesome name="inbox" size={28} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/40 text-sm mt-2">No public repositories</Text>
            </View>
          </View>
        ) : (
          repos.map((repo, index) => (
            <Link key={repo.id} href={`/${username}/${repo.name}`} asChild>
              <Pressable className={index < repos.length - 1 ? "mb-2" : ""}>
                <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center p-3.5 relative z-10">
                    <View className="w-10 h-10 bg-blue-500/20 items-center justify-center mr-3">
                      <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                    </View>
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
                    <View className="flex-row items-center bg-yellow-500/20 px-2 py-1 rounded-lg">
                      <FontAwesome name="star" size={11} color="#fbbf24" />
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
