import { useState } from "react";
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard, GlassButton, GlassGroup } from "@/components/ui/glass";
import { usePublicRepositories } from "@/lib/hooks/use-repository";
import { usePublicUsers } from "@/lib/hooks/use-user";

type SortOption = "stars" | "updated" | "created";

export default function ExploreScreen() {
  const [sortBy, setSortBy] = useState<SortOption>("stars");
  const [tab, setTab] = useState<"repos" | "users">("repos");

  const {
    data: reposData,
    isLoading: reposLoading,
    refetch: refetchRepos,
    isRefetching: isRefetchingRepos,
  } = usePublicRepositories(sortBy, 20);

  const {
    data: usersData,
    isLoading: usersLoading,
    refetch: refetchUsers,
    isRefetching: isRefetchingUsers,
  } = usePublicUsers("newest", 20);

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
        <LinearGradient
          colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={handleRefresh}
            tintColor="#60a5fa"
          />
        }
      >
        <View style={styles.header}>
          <GlassGroup style={styles.tabGroup} spacing={4}>
            <Pressable onPress={() => setTab("repos")}>
              <GlassButton
                style={[styles.tabButton, tab === "repos" && styles.tabActive]}
                interactive
                tintColor={tab === "repos" ? "#3b82f6" : undefined}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "repos" && styles.tabTextActive,
                  ]}
                >
                  Repositories
                </Text>
              </GlassButton>
            </Pressable>
            <Pressable onPress={() => setTab("users")}>
              <GlassButton
                style={[styles.tabButton, tab === "users" && styles.tabActive]}
                interactive
                tintColor={tab === "users" ? "#3b82f6" : undefined}
              >
                <Text
                  style={[
                    styles.tabText,
                    tab === "users" && styles.tabTextActive,
                  ]}
                >
                  Users
                </Text>
              </GlassButton>
            </Pressable>
          </GlassGroup>
        </View>

        {tab === "repos" && (
          <View style={styles.filterRow}>
            {(["stars", "updated", "created"] as SortOption[]).map((option) => (
              <Pressable key={option} onPress={() => setSortBy(option)}>
                <GlassButton
                  style={[
                    styles.filterButton,
                    sortBy === option && styles.filterActive,
                  ]}
                  tintColor={sortBy === option ? "#8b5cf6" : undefined}
                >
                  <Text
                    style={[
                      styles.filterText,
                      sortBy === option && styles.filterTextActive,
                    ]}
                  >
                    {option.charAt(0).toUpperCase() + option.slice(1)}
                  </Text>
                </GlassButton>
              </Pressable>
            ))}
          </View>
        )}

        {tab === "repos"
          ? repos.map((repo) => (
              <Link
                key={repo.id}
                href={`/${repo.owner.username}/${repo.name}`}
                asChild
              >
                <Pressable>
                  <GlassCard style={styles.card} interactive>
                    <View style={styles.cardHeader}>
                      <View style={styles.cardIcon}>
                        <FontAwesome
                          name="code-fork"
                          size={18}
                          color="#60a5fa"
                        />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>
                          {repo.owner.username}/{repo.name}
                        </Text>
                        {repo.description && (
                          <Text style={styles.cardSubtitle} numberOfLines={2}>
                            {repo.description}
                          </Text>
                        )}
                      </View>
                      <View style={styles.starBadge}>
                        <FontAwesome name="star" size={12} color="#fbbf24" />
                        <Text style={styles.starCount}>{repo.starCount}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </Pressable>
              </Link>
            ))
          : users.map((user) => (
              <Link key={user.id} href={`/${user.username}`} asChild>
                <Pressable>
                  <GlassCard style={styles.card} interactive>
                    <View style={styles.cardHeader}>
                      <View style={styles.userAvatar}>
                        <FontAwesome name="user" size={22} color="#a78bfa" />
                      </View>
                      <View style={styles.cardInfo}>
                        <Text style={styles.cardTitle}>{user.name}</Text>
                        <Text style={styles.cardSubtitle}>@{user.username}</Text>
                        {user.bio && (
                          <Text style={styles.userBio} numberOfLines={1}>
                            {user.bio}
                          </Text>
                        )}
                      </View>
                      <View style={styles.repoBadge}>
                        <FontAwesome
                          name="code-fork"
                          size={12}
                          color="#60a5fa"
                        />
                        <Text style={styles.repoCount}>{user.repoCount}</Text>
                      </View>
                    </View>
                  </GlassCard>
                </Pressable>
              </Link>
            ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
  },
  header: {
    marginBottom: 16,
  },
  tabGroup: {
    flexDirection: "row",
    gap: 8,
  },
  tabButton: {
    paddingVertical: 10,
    paddingHorizontal: 20,
  },
  tabActive: {},
  tabText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontWeight: "600",
    fontSize: 14,
  },
  tabTextActive: {
    color: "#ffffff",
  },
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
  },
  filterActive: {},
  filterText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
    fontWeight: "500",
  },
  filterTextActive: {
    color: "#ffffff",
  },
  card: {
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "rgba(167, 139, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  cardInfo: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  cardSubtitle: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 2,
  },
  userBio: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 4,
  },
  starBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(251, 191, 36, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  starCount: {
    fontSize: 12,
    color: "#fbbf24",
    marginLeft: 4,
    fontWeight: "600",
  },
  repoBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  repoCount: {
    fontSize: 12,
    color: "#60a5fa",
    marginLeft: 4,
    fontWeight: "600",
  },
});
