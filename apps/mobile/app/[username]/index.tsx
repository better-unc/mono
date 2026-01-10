import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/ui/glass";
import { useUserProfile } from "@/lib/hooks/use-user";
import { useUserRepositories } from "@/lib/hooks/use-repository";

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();

  const {
    data: user,
    isLoading: userLoading,
    error: userError,
    refetch: refetchUser,
    isRefetching: isRefetchingUser,
  } = useUserProfile(username || "");

  const {
    data: reposData,
    isLoading: reposLoading,
    refetch: refetchRepos,
    isRefetching: isRefetchingRepos,
  } = useUserRepositories(username || "");

  const repos = reposData?.repos || [];
  const isLoading = userLoading || reposLoading;
  const isRefetching = isRefetchingUser || isRefetchingRepos;

  const handleRefresh = () => {
    refetchUser();
    refetchRepos();
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: "" }} />
        <LinearGradient
          colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (userError || !user) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: "Error" }} />
        <LinearGradient
          colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]}
          style={StyleSheet.absoluteFill}
        />
        <GlassCard style={styles.errorCard}>
          <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
          <Text style={styles.errorText}>
            {userError?.message || "User not found"}
          </Text>
        </GlassCard>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: user.name }} />
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
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={["#a78bfa", "#8b5cf6", "#6366f1"]}
              style={styles.avatarGradient}
            >
              <FontAwesome name="user" size={40} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileUsername}>@{user.username}</Text>
          {user.bio && <Text style={styles.profileBio}>{user.bio}</Text>}

          {(user.location || user.website) && (
            <View style={styles.metaContainer}>
              {user.location && (
                <View style={styles.metaItem}>
                  <View style={styles.metaIconBg}>
                    <FontAwesome name="map-marker" size={12} color="#60a5fa" />
                  </View>
                  <Text style={styles.metaText}>{user.location}</Text>
                </View>
              )}
              {user.website && (
                <View style={styles.metaItem}>
                  <View style={styles.metaIconBg}>
                    <FontAwesome name="link" size={12} color="#60a5fa" />
                  </View>
                  <Text style={styles.metaLink}>{user.website}</Text>
                </View>
              )}
            </View>
          )}

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{repos.length}</Text>
              <Text style={styles.statLabel}>Repositories</Text>
            </View>
          </View>
        </GlassCard>

        <Text style={styles.sectionTitle}>Repositories</Text>

        {repos.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>No public repositories</Text>
          </GlassCard>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${username}/${repo.name}`} asChild>
              <Pressable>
                <GlassCard style={styles.repoCard} interactive>
                  <View style={styles.repoHeader}>
                    <View style={styles.repoIcon}>
                      <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                    </View>
                    <View style={styles.repoInfo}>
                      <Text style={styles.repoName}>{repo.name}</Text>
                      {repo.description && (
                        <Text style={styles.repoDescription} numberOfLines={2}>
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
        )}
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
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  errorCard: {
    padding: 32,
    alignItems: "center",
  },
  errorText: {
    color: "#f87171",
    fontSize: 16,
    marginTop: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  profileCard: {
    padding: 24,
    alignItems: "center",
    marginBottom: 24,
  },
  avatarContainer: {
    marginBottom: 16,
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 24,
    fontWeight: "700",
    color: "#ffffff",
  },
  profileUsername: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 4,
  },
  profileBio: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    textAlign: "center",
    marginTop: 14,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  metaContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 16,
    marginTop: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  metaIconBg: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  metaText: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
  },
  metaLink: {
    fontSize: 13,
    color: "#60a5fa",
  },
  statsRow: {
    flexDirection: "row",
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.1)",
  },
  statItem: {
    alignItems: "center",
    paddingHorizontal: 24,
  },
  statValue: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
  },
  statLabel: {
    fontSize: 12,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  emptyCard: {
    padding: 32,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    marginTop: 12,
  },
  repoCard: {
    padding: 16,
    marginBottom: 12,
  },
  repoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  repoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(96, 165, 250, 0.15)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  repoInfo: {
    flex: 1,
  },
  repoName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  repoDescription: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.6)",
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
});
