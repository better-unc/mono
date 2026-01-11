import { useState } from "react";
import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
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
      <View style={styles.loadingContainer}>
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View style={styles.flex1}>
      <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View style={styles.tabRow}>
          <Pressable onPress={() => setTab("repos")} style={styles.tabButtonWrapper}>
            <View style={[styles.tabButton, tab === "repos" && styles.tabButtonActive]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={[styles.tabButtonText, tab === "repos" && styles.tabButtonTextActive]}>Repositories</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => setTab("users")}>
            <View style={[styles.tabButton, tab === "users" && styles.tabButtonActive]}>
              <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
              <Text style={[styles.tabButtonText, tab === "users" && styles.tabButtonTextActive]}>Users</Text>
            </View>
          </Pressable>
        </View>

        {tab === "repos" && (
          <View style={styles.sortRow}>
            {(["stars", "updated", "created"] as SortOption[]).map((option, index) => (
              <Pressable key={option} onPress={() => setSortBy(option)} style={index < 2 ? styles.sortButtonWrapper : undefined}>
                <View style={[styles.sortButton, sortBy === option && styles.sortButtonActive]}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <Text style={[styles.sortButtonText, sortBy === option && styles.sortButtonTextActive]}>
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
                <Pressable style={styles.cardWrapper}>
                  <View style={styles.card}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.cardContent}>
                      <View style={styles.repoIcon}>
                        <FontAwesome name="code-fork" size={18} color="#60a5fa" />
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>{repo.owner.username}/{repo.name}</Text>
                        {repo.description && (
                          <Text style={styles.itemSubtitle} numberOfLines={2}>{repo.description}</Text>
                        )}
                      </View>
                      <View style={styles.starBadge}>
                        <FontAwesome name="star" size={12} color="#fbbf24" />
                        <Text style={styles.starCount}>{repo.starCount}</Text>
                      </View>
                    </View>
                  </View>
                </Pressable>
              </Link>
            ))
          : users.map((user) => (
              <Link key={user.id} href={`/${user.username}`} asChild>
                <Pressable style={styles.cardWrapper}>
                  <View style={styles.card}>
                    <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                    <View style={styles.cardContent}>
                      <View style={styles.userIcon}>
                        <FontAwesome name="user" size={22} color="#a78bfa" />
                      </View>
                      <View style={styles.itemInfo}>
                        <Text style={styles.itemTitle}>{user.name}</Text>
                        <Text style={styles.username}>@{user.username}</Text>
                        {user.bio && (
                          <Text style={styles.bio} numberOfLines={1}>{user.bio}</Text>
                        )}
                      </View>
                      <View style={styles.repoBadge}>
                        <FontAwesome name="code-fork" size={12} color="#60a5fa" />
                        <Text style={styles.repoCount}>{user.repoCount}</Text>
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

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 144,
  },
  tabRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  tabButtonWrapper: {
    marginRight: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(60, 60, 90, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  tabButtonActive: {
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    borderColor: "rgba(59, 130, 246, 0.4)",
  },
  tabButtonText: {
    fontWeight: "600",
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    position: "relative",
    zIndex: 1,
  },
  tabButtonTextActive: {
    color: "#ffffff",
  },
  sortRow: {
    flexDirection: "row",
    marginBottom: 20,
  },
  sortButtonWrapper: {
    marginRight: 8,
  },
  sortButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(60, 60, 90, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.08)",
  },
  sortButtonActive: {
    backgroundColor: "rgba(139, 92, 246, 0.3)",
    borderColor: "rgba(139, 92, 246, 0.4)",
  },
  sortButtonText: {
    fontSize: 13,
    fontWeight: "500",
    color: "rgba(255, 255, 255, 0.5)",
    position: "relative",
    zIndex: 1,
  },
  sortButtonTextActive: {
    color: "#ffffff",
  },
  cardWrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  repoIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(167, 139, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
    marginRight: 12,
  },
  itemTitle: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  itemSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginTop: 4,
  },
  username: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    marginTop: 2,
  },
  bio: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    marginTop: 4,
  },
  starBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  starCount: {
    color: "#fbbf24",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
  repoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  repoCount: {
    color: "#60a5fa",
    fontSize: 12,
    fontWeight: "600",
    marginLeft: 4,
  },
});
