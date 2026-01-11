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
      <View style={styles.loadingContainer}>
        <Stack.Screen options={{ title: "" }} />
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (userError || !user) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: "Error" }} />
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.errorContent}>
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text style={styles.errorText}>{userError?.message || "User not found"}</Text>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.flex1}>
      <Stack.Screen options={{ headerTitle: user.name, headerShown: false }} />
      <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View style={styles.profileCard}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.profileContent}>
            <LinearGradient colors={["#a78bfa", "#8b5cf6", "#6366f1"]} style={styles.avatarGradient}>
              <FontAwesome name="user" size={40} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userHandle}>@{user.username}</Text>
            {user.bio && <Text style={styles.userBio}>{user.bio}</Text>}

            {(user.location || user.website) && (
              <View style={styles.metaRow}>
                {user.location && (
                  <View style={styles.metaItem}>
                    <View style={styles.metaIcon}>
                      <FontAwesome name="map-marker" size={12} color="#60a5fa" />
                    </View>
                    <Text style={styles.metaText}>{user.location}</Text>
                  </View>
                )}
                {user.website && (
                  <View style={styles.metaItem}>
                    <View style={styles.metaIcon}>
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
          </View>
        </View>

        <Text style={styles.sectionTitle}>Repositories</Text>

        {repos.length === 0 ? (
          <View style={styles.card}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.emptyContent}>
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>No public repositories</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${username}/${repo.name}`} asChild>
              <Pressable style={styles.repoCardWrapper}>
                <View style={styles.card}>
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.repoContent}>
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
                </View>
              </Pressable>
            </Link>
          ))
        )}
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
  errorContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  errorContent: {
    padding: 32,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  errorText: {
    color: "#f87171",
    fontSize: 16,
    marginTop: 16,
  },
  profileCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 24,
  },
  profileContent: {
    padding: 24,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  avatarGradient: {
    width: 88,
    height: 88,
    borderRadius: 44,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  userName: {
    color: "#ffffff",
    fontSize: 24,
    fontWeight: "700",
  },
  userHandle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 16,
    marginTop: 4,
  },
  userBio: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
    textAlign: "center",
    marginTop: 16,
    lineHeight: 20,
    paddingHorizontal: 8,
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    marginTop: 16,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    marginRight: 16,
  },
  metaIcon: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 8,
  },
  metaText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
  },
  metaLink: {
    color: "#60a5fa",
    fontSize: 13,
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
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  statLabel: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyContent: {
    padding: 32,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 14,
    marginTop: 12,
  },
  repoCardWrapper: {
    marginBottom: 12,
  },
  repoContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  repoIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(96, 165, 250, 0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  repoInfo: {
    flex: 1,
    marginRight: 12,
  },
  repoName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },
  repoDescription: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 13,
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
});
