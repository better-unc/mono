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
import { useSession } from "@/lib/auth-client";
import { GlassCard, GlassButton } from "@/components/ui/glass";
import { usePublicRepositories } from "@/lib/hooks/use-repository";

export default function HomeScreen() {
  const { data: session, isPending } = useSession();

  const {
    data: reposData,
    isLoading,
    refetch,
    isRefetching,
  } = usePublicRepositories("updated", 10);

  const repos = reposData?.repos || [];

  const handleRefresh = () => {
    refetch();
  };

  if (isPending || isLoading) {
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
        {session?.user ? (
          <GlassCard style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              Welcome back, {session.user.name}!
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Check out the latest repositories below
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.welcomeCard} tintColor="#3b82f6">
            <Text style={styles.welcomeTitle}>Welcome to GitBruv</Text>
            <Text style={styles.welcomeSubtitle}>
              Sign in to start exploring and creating repositories
            </Text>
            <Link href="/(auth)/login" asChild>
              <Pressable>
                <GlassButton style={styles.signInButton} interactive>
                  <Text style={styles.signInButtonText}>Sign In</Text>
                </GlassButton>
              </Pressable>
            </Link>
          </GlassCard>
        )}

        <Text style={styles.sectionTitle}>Recent Repositories</Text>

        {repos.length === 0 ? (
          <GlassCard style={styles.emptyCard}>
            <Text style={styles.emptyText}>No repositories found</Text>
          </GlassCard>
        ) : (
          repos.map((repo) => (
            <Link
              key={repo.id}
              href={`/${repo.owner.username}/${repo.name}`}
              asChild
            >
              <Pressable>
                <GlassCard style={styles.repoCard} interactive>
                  <View style={styles.repoHeader}>
                    <View style={styles.repoIcon}>
                      <FontAwesome name="code-fork" size={18} color="#60a5fa" />
                    </View>
                    <View style={styles.repoInfo}>
                      <Text style={styles.repoName}>
                        {repo.owner.username}/{repo.name}
                      </Text>
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
  welcomeCard: {
    padding: 20,
    marginBottom: 24,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 6,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
  },
  signInButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
  },
  signInButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  emptyCard: {
    padding: 24,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
    marginTop: 2,
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
