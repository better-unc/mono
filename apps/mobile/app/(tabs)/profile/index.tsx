import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  Pressable,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import { Link, router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useSession, signOut } from "@/lib/auth-client";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { useUserRepositories } from "@/lib/hooks/use-repository";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileScreen() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  const username = (session?.user as { username?: string })?.username || "";

  const {
    data: reposData,
    isLoading,
    refetch,
    isRefetching,
  } = useUserRepositories(username);

  const repos = reposData?.repos || [];

  const handleRefresh = () => {
    refetch();
  };

  const handleSignOut = async () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign Out",
        style: "destructive",
        onPress: async () => {
          await signOut();
          queryClient.clear();
          router.replace("/(auth)/login");
        },
      },
    ]);
  };

  if (isPending) {
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

  if (!session?.user) {
    return (
      <View style={styles.container}>
        <LinearGradient
          colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]}
          style={StyleSheet.absoluteFill}
        />
        <View style={styles.signedOutContainer}>
          <GlassCard style={styles.signedOutCard}>
            <View style={styles.avatarLarge}>
              <FontAwesome name="user" size={48} color="rgba(255,255,255,0.5)" />
            </View>
            <Text style={styles.signedOutTitle}>Not signed in</Text>
            <Text style={styles.signedOutSubtitle}>
              Sign in to view your profile and repositories
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <GlassButton style={styles.signInButton} interactive tintColor="#3b82f6">
                  <Text style={styles.signInButtonText}>Sign In</Text>
                </GlassButton>
              </Pressable>
            </Link>
          </GlassCard>
        </View>
      </View>
    );
  }

  const user = session.user as {
    name?: string;
    email?: string;
    username?: string;
  };

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
        <GlassCard style={styles.profileCard}>
          <View style={styles.avatarContainer}>
            <LinearGradient
              colors={["#8b5cf6", "#6366f1", "#3b82f6"]}
              style={styles.avatarGradient}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <FontAwesome name="user" size={40} color="#ffffff" />
            </LinearGradient>
          </View>
          <Text style={styles.profileName}>{user.name}</Text>
          <Text style={styles.profileUsername}>@{user.username}</Text>
          <Text style={styles.profileEmail}>{user.email}</Text>
        </GlassCard>

        <Text style={styles.sectionTitle}>Your Repositories</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color="#60a5fa" />
        ) : repos.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
            <Text style={styles.emptyText}>
              You haven't created any repositories yet
            </Text>
          </GlassCard>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${user.username}/${repo.name}`} asChild>
              <Pressable>
                <GlassCard style={styles.repoCard} interactive>
                  <View style={styles.repoHeader}>
                    <View style={styles.repoInfo}>
                      <View style={styles.repoNameRow}>
                        <Text style={styles.repoName}>{repo.name}</Text>
                        <View
                          style={[
                            styles.visibilityBadge,
                            repo.visibility === "private"
                              ? styles.privateBadge
                              : styles.publicBadge,
                          ]}
                        >
                          <Text
                            style={[
                              styles.visibilityText,
                              repo.visibility === "private"
                                ? styles.privateText
                                : styles.publicText,
                            ]}
                          >
                            {repo.visibility}
                          </Text>
                        </View>
                      </View>
                      {repo.description && (
                        <Text style={styles.repoDescription} numberOfLines={1}>
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

        <Pressable onPress={handleSignOut}>
          <GlassCard style={styles.signOutCard} tintColor="#ef4444">
            <View style={styles.signOutContent}>
              <FontAwesome name="sign-out" size={18} color="#f87171" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
          </GlassCard>
        </Pressable>
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
  signedOutContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  signedOutCard: {
    padding: 32,
    alignItems: "center",
    width: "100%",
    maxWidth: 320,
  },
  avatarLarge: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  signedOutTitle: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 8,
  },
  signedOutSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.6)",
    textAlign: "center",
    marginBottom: 24,
  },
  signInButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
  },
  signInButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 120,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  profileName: {
    fontSize: 22,
    fontWeight: "700",
    color: "#ffffff",
  },
  profileUsername: {
    fontSize: 15,
    color: "rgba(255, 255, 255, 0.6)",
    marginTop: 4,
  },
  profileEmail: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.4)",
    marginTop: 4,
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
    marginBottom: 16,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    marginTop: 12,
    textAlign: "center",
  },
  repoCard: {
    padding: 16,
    marginBottom: 12,
  },
  repoHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  repoInfo: {
    flex: 1,
  },
  repoNameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  repoName: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  visibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  privateBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
  },
  publicBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  visibilityText: {
    fontSize: 11,
    fontWeight: "600",
  },
  privateText: {
    color: "#fbbf24",
  },
  publicText: {
    color: "#22c55e",
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
  signOutCard: {
    padding: 16,
    marginTop: 8,
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  signOutText: {
    color: "#f87171",
    fontWeight: "600",
    fontSize: 15,
  },
});
