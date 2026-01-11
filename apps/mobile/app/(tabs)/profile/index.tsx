import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, Alert, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { useSession, signOut } from "@/lib/auth-client";
import { useUserRepositories } from "@/lib/hooks/use-repository";
import { useQueryClient } from "@tanstack/react-query";

export default function ProfileScreen() {
  const { data: session, isPending } = useSession();
  const queryClient = useQueryClient();

  const username = (session?.user as { username?: string })?.username || "";
  const { data: reposData, isLoading, refetch, isRefetching } = useUserRepositories(username);

  const repos = reposData?.repos || [];
  const handleRefresh = () => refetch();

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
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (!session?.user) {
    return (
      <View style={styles.flex1}>
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <View style={styles.notSignedInContainer}>
          <View style={styles.notSignedInCard}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.notSignedInContent}>
              <View style={styles.placeholderAvatar}>
                <FontAwesome name="user" size={40} color="rgba(255,255,255,0.5)" />
              </View>
              <Text style={styles.notSignedInTitle}>Not signed in</Text>
              <Text style={styles.notSignedInSubtitle}>Sign in to view your profile and repositories</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable style={styles.signInButton}>
                  <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                  <Text style={styles.signInButtonText}>Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        </View>
      </View>
    );
  }

  const user = session.user as { name?: string; email?: string; username?: string };

  return (
    <View style={styles.flex1}>
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
            <LinearGradient colors={["#8b5cf6", "#6366f1", "#3b82f6"]} style={styles.avatarGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
              <FontAwesome name="user" size={36} color="#ffffff" />
            </LinearGradient>
            <Text style={styles.userName}>{user.name}</Text>
            <Text style={styles.userHandle}>@{user.username}</Text>
            <Text style={styles.userEmail}>{user.email}</Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Your Repositories</Text>

        {isLoading ? (
          <ActivityIndicator size="small" color="#60a5fa" />
        ) : repos.length === 0 ? (
          <View style={styles.emptyCard}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.emptyContent}>
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyText}>You haven't created any repositories yet</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${user.username}/${repo.name}`} asChild>
              <Pressable style={styles.repoCardWrapper}>
                <View style={styles.card}>
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.repoContent}>
                    <View style={styles.repoInfo}>
                      <View style={styles.repoTitleRow}>
                        <Text style={styles.repoName}>{repo.name}</Text>
                        <View style={[styles.visibilityBadge, repo.visibility === "private" ? styles.privateBadge : styles.publicBadge]}>
                          <Text style={[styles.visibilityText, repo.visibility === "private" ? styles.privateText : styles.publicText]}>{repo.visibility}</Text>
                        </View>
                      </View>
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

        <Pressable onPress={handleSignOut} style={styles.signOutWrapper}>
          <View style={styles.signOutCard}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.signOutContent}>
              <FontAwesome name="sign-out" size={18} color="#f87171" />
              <Text style={styles.signOutText}>Sign Out</Text>
            </View>
          </View>
        </Pressable>
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
  notSignedInContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
  },
  notSignedInCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    width: "100%",
    maxWidth: 320,
  },
  notSignedInContent: {
    padding: 32,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  placeholderAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255, 255, 255, 0.1)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  notSignedInTitle: {
    color: "#ffffff",
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 8,
  },
  notSignedInSubtitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 14,
    textAlign: "center",
    marginBottom: 24,
  },
  signInButton: {
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "rgba(59, 130, 246, 0.3)",
  },
  signInButtonText: {
    color: "#ffffff",
    fontWeight: "600",
    fontSize: 16,
    position: "relative",
    zIndex: 1,
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
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  userName: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "700",
  },
  userHandle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 15,
    marginTop: 4,
  },
  userEmail: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 13,
    marginTop: 4,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 18,
    fontWeight: "600",
    marginBottom: 16,
  },
  emptyCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
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
    textAlign: "center",
  },
  repoCardWrapper: {
    marginBottom: 12,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  repoContent: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  repoInfo: {
    flex: 1,
    marginRight: 12,
  },
  repoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  repoName: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
    marginRight: 8,
  },
  visibilityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  privateBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.2)",
  },
  publicBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.2)",
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
  signOutWrapper: {
    marginTop: 8,
  },
  signOutCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(239, 68, 68, 0.15)",
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  signOutContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  signOutText: {
    color: "#f87171",
    fontWeight: "600",
    fontSize: 15,
    marginLeft: 8,
  },
});
