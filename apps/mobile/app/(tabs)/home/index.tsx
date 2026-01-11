import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@/lib/auth-client";
import { usePublicRepositories } from "@/lib/hooks/use-repository";
import { BlurView } from "expo-blur";

export default function HomeScreen() {
  const { data: session, isPending } = useSession();
  const { data: reposData, isLoading, refetch, isRefetching } = usePublicRepositories("updated", 10);

  const repos = reposData?.repos || [];
  const handleRefresh = () => refetch();

  if (isPending || isLoading) {
    return (
      <View style={styles.container}>
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
        {session?.user ? (
          <View style={styles.card}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              <Text style={styles.welcomeTitle}>Welcome back, {session.user.name}!</Text>
              <Text style={styles.welcomeSubtitle}>Check out the latest repositories below</Text>
            </View>
          </View>
        ) : (
          <View style={[styles.card, styles.welcomeCard]}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.cardContent}>
              <Text style={styles.welcomeTitle}>Welcome to GitBruv</Text>
              <Text style={styles.welcomeSubtitle}>Sign in to start exploring and creating repositories</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.signInButton}>
                  <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                  <Text style={styles.signInText}>Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}

        <Text style={styles.sectionTitle}>Recent Repositories</Text>

        {repos.length === 0 ? (
          <View style={styles.card}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={[styles.cardContent, styles.emptyState]}>
              <Text style={styles.emptyText}>No repositories found</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${repo.owner.username}/${repo.name}`} asChild>
              <Pressable style={styles.repoCardWrapper}>
                <View style={styles.card}>
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.repoContent}>
                    <View style={styles.repoIcon}>
                      <FontAwesome name="code-fork" size={18} color="#60a5fa" />
                    </View>
                    <View style={styles.repoInfo}>
                      <Text style={styles.repoName}>{repo.owner.username}/{repo.name}</Text>
                      {repo.description && (
                        <Text style={styles.repoDescription} numberOfLines={1}>{repo.description}</Text>
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
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 144,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 12,
  },
  welcomeCard: {
    borderColor: "rgba(59, 130, 246, 0.3)",
  },
  cardContent: {
    padding: 20,
    position: "relative",
    zIndex: 1,
  },
  welcomeTitle: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  welcomeSubtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 14,
  },
  signInButton: {
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignSelf: "flex-start",
    overflow: "hidden",
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  signInText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 15,
    position: "relative",
    zIndex: 1,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
    marginTop: 8,
  },
  emptyState: {
    alignItems: "center",
    padding: 24,
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
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
    width: 40,
    height: 40,
    borderRadius: 20,
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
