import { useState, useCallback } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useInfinitePublicRepositories, useInfinitePublicUsers } from "@gitbruv/hooks";
import { UserAvatar } from "@/components/user-avatar";

type SortOption = "stars" | "updated" | "created";

const PAGE_SIZE = 20;

export default function ExploreScreen() {
  const [sortBy, setSortBy] = useState<SortOption>("stars");
  const [tab, setTab] = useState<"repos" | "users">("repos");

  const {
    data: reposData,
    isLoading: reposLoading,
    refetch: refetchRepos,
    isRefetching: isRefetchingRepos,
    fetchNextPage: fetchNextRepos,
    hasNextPage: hasNextRepos,
    isFetchingNextPage: isFetchingNextRepos,
  } = useInfinitePublicRepositories(sortBy, PAGE_SIZE);

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
    isRefetching: isRefetchingUsers,
    fetchNextPage: fetchNextUsers,
    hasNextPage: hasNextUsers,
    isFetchingNextPage: isFetchingNextUsers,
  } = useInfinitePublicUsers("newest", PAGE_SIZE);

  const repos = reposData?.pages.flatMap((page) => page.repos) || [];
  const users = usersData?.pages.flatMap((page) => page.users) || [];
  const isLoading = (tab === "repos" ? reposLoading : usersLoading) && repos.length === 0 && users.length === 0;
  const isRefetching = tab === "repos" ? isRefetchingRepos : isRefetchingUsers;
  const isFetchingNext = tab === "repos" ? isFetchingNextRepos : isFetchingNextUsers;
  const hasNext = tab === "repos" ? hasNextRepos : hasNextUsers;

  const handleRefresh = () => {
    refetchRepos();
    refetchUsers();
  };

  const handleLoadMore = useCallback(() => {
    if (hasNext && !isFetchingNext) {
      if (tab === "repos") {
        fetchNextRepos();
      } else {
        fetchNextUsers();
      }
    }
  }, [hasNext, isFetchingNext, tab, fetchNextRepos, fetchNextUsers]);

  if (isLoading) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
        onScroll={({ nativeEvent }) => {
          const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
          const paddingToBottom = 20;
          if (layoutMeasurement.height + contentOffset.y >= contentSize.height - paddingToBottom) {
            handleLoadMore();
          }
        }}
        scrollEventThrottle={400}
      >
        <View className="flex-row mb-5">
          <Pressable onPress={() => setTab("repos")} className="mr-2">
            <View
              className={`py-2.5 px-5 overflow-hidden border ${
                tab === "repos" ? "bg-blue-600/30 border-blue-500/40" : "bg-[rgba(60,60,90,0.4)] border-white/10"
              }`}
            >
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text className={`font-semibold text-sm relative z-10 ${tab === "repos" ? "text-white" : "text-white/60"}`}>Repositories</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setTab("users")}>
            <View
              className={`py-2.5 px-5 overflow-hidden border ${
                tab === "users" ? "bg-blue-600/30 border-blue-500/40" : "bg-[rgba(60,60,90,0.4)] border-white/10"
              }`}
            >
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text className={`font-semibold text-sm relative z-10 ${tab === "users" ? "text-white" : "text-white/60"}`}>Users</Text>
            </View>
          </Pressable>
        </View>

        {tab === "repos" && (
          <View className="flex-row mb-5">
            {(["stars", "updated", "created"] as SortOption[]).map((option, index) => (
              <Pressable key={option} onPress={() => setSortBy(option)} className={index < 2 ? "mr-2" : ""}>
                <View
                  className={`py-1.5 px-3.5 overflow-hidden border ${
                    sortBy === option ? "bg-purple-500/30 border-purple-500/40" : "bg-[rgba(60,60,90,0.3)] border-white/8"
                  }`}
                >
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
                  <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View className="flex-row items-center p-4 relative z-10">
                      <UserAvatar avatarUrl={repo.owner.avatarUrl} size={40} style={{ marginRight: 12 }} />
                      <View style={{ flex: 1 }} className="mr-3">
                        <Text className="text-white text-[15px] font-semibold">
                          {repo.owner.username}/{repo.name}
                        </Text>
                        {repo.description && (
                          <Text className="text-white/50 text-[13px] mt-1" numberOfLines={2}>
                            {repo.description}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center bg-yellow-500/20 px-2.5 py-1.5">
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
                  <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View className="flex-row items-center p-4 relative z-10">
                      <UserAvatar
                        avatarUrl={user.avatarUrl}
                        size={48}
                        fallbackColor="rgba(167, 139, 250, 0.2)"
                        fallbackIconColor="#a78bfa"
                        style={{ marginRight: 12 }}
                      />
                      <View style={{ flex: 1 }} className="mr-3">
                        <Text className="text-white text-[15px] font-semibold">{user.name}</Text>
                        <Text className="text-white/50 text-[13px] mt-0.5">@{user.username}</Text>
                        {user.bio && (
                          <Text className="text-white/40 text-xs mt-1" numberOfLines={1}>
                            {user.bio}
                          </Text>
                        )}
                      </View>
                      <View className="flex-row items-center bg-blue-500/20 px-2.5 py-1.5">
                        <FontAwesome name="code-fork" size={12} color="#60a5fa" />
                        <Text className="text-blue-400 text-xs font-semibold ml-1">{user.repoCount}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>
            ))}

        {hasNext && (
          <View className="py-4 items-center">
            {isFetchingNext ? (
              <ActivityIndicator size="small" color="#60a5fa" />
            ) : (
              <Pressable onPress={handleLoadMore}>
                <View className="overflow-hidden bg-[rgba(60,60,90,0.4)] border border-white/10 px-4 py-2">
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <Text className="text-white/70 text-sm font-medium relative z-10">Load More</Text>
                </View>
              </Pressable>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}
