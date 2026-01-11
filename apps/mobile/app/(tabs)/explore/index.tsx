import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { usePublicRepositories } from "@/lib/hooks/use-repository";
import { usePublicUsers } from "@/lib/hooks/use-user";

type SortOption = "stars" | "updated" | "created";

export default function ExploreScreen() {
  const [sortBy, setSortBy] = useState<SortOption>("stars");
  const [tab, setTab] = useState<"repos" | "users">("repos");

  const { data: reposData, isLoading: reposLoading, refetch: refetchRepos, isRefetching: isRefetchingRepos } = usePublicRepositories(sortBy, 20);
  const { data: usersData, isLoading: usersLoading, refetch: refetchUsers, isRefetching: isRefetchingUsers } = usePublicUsers("newest", 20);

  const repos = reposData?.repos || [];
  const users = usersData?.users || [];
  const isLoading = reposLoading || usersLoading;
  const isRefetching = isRefetchingRepos || isRefetchingUsers;

  const handleRefresh = () => {
    refetchRepos();
    refetchUsers();
  };

  if (isLoading) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View className="flex-1">
      <ScrollView
        className="flex-1"
        contentContainerClassName="px-4 pt-4 pb-36"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="flex-row mb-5">
          <Pressable onPress={() => setTab("repos")} className="mr-2">
            <View className={`py-2.5 px-5 rounded-xl overflow-hidden border ${tab === "repos" ? "bg-blue-600/30 border-blue-500/40" : "bg-[rgba(60,60,90,0.4)] border-white/10"}`}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text className={`font-semibold text-sm relative z-10 ${tab === "repos" ? "text-white" : "text-white/60"}`}>Repositories</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setTab("users")}>
            <View className={`py-2.5 px-5 rounded-xl overflow-hidden border ${tab === "users" ? "bg-blue-600/30 border-blue-500/40" : "bg-[rgba(60,60,90,0.4)] border-white/10"}`}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text className={`font-semibold text-sm relative z-10 ${tab === "users" ? "text-white" : "text-white/60"}`}>Users</Text>
            </View>
          </Pressable>
        </View>

        {tab === "repos" && (
          <View className="flex-row mb-5">
            {(["stars", "updated", "created"] as SortOption[]).map((option, index) => (
              <Pressable key={option} onPress={() => setSortBy(option)} className={index < 2 ? "mr-2" : ""}>
                <View className={`py-1.5 px-3.5 rounded-[10px] overflow-hidden border ${sortBy === option ? "bg-purple-500/30 border-purple-500/40" : "bg-[rgba(60,60,90,0.3)] border-white/8"}`}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <Text className={`text-[13px] font-medium relative z-10 ${sortBy === option ? "text-white" : "text-white/50"}`}>
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </View>
              </Pressable>
            ))}
          </View>
        )}

        {tab === "repos"
          ? repos.map((repo) => (
              <Link key={repo.id} href={`/${repo.owner.username}/${repo.name}`} asChild>
                <Pressable className="mb-3">
                  <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View className="flex-row items-center p-4 relative z-10">
                      <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                        <FontAwesome name="code-fork" size={18} color="#60a5fa" />
                      </View>
                      <View className="flex-1 mr-3">
                        <Text className="text-white text-[15px] font-semibold">
                          {repo.owner.username}/{repo.name}
                        </Text>
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
          : users.map((user) => (
              <Link key={user.id} href={`/${user.username}`} asChild>
                <Pressable className="mb-3">
                  <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View className="flex-row items-center p-4 relative z-10">
                      <View className="w-12 h-12 rounded-full bg-purple-500/20 items-center justify-center mr-3">
                        <FontAwesome name="user" size={22} color="#a78bfa" />
                      </View>
                      <View className="flex-1 mr-3">
                        <Text className="text-white text-[15px] font-semibold">{user.name}</Text>
                        <Text className="text-white/50 text-[13px] mt-0.5">@{user.username}</Text>
                        {user.bio && (
                          <Text className="text-white/40 text-xs mt-1" numberOfLines={1}>
                            {user.bio}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center bg-blue-500/20 px-2.5 py-1.5 rounded-xl">
                        <FontAwesome name="code-fork" size={12} color="#60a5fa" />
                        <Text className="text-blue-400 text-xs font-semibold ml-1">{user.repoCount}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>
            ))}
      </ScrollView>
    </View>
  );
}
