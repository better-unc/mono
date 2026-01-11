import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import { type FileEntry } from "@/lib/api";
import { useRepositoryPageData, useToggleStar } from "@/lib/hooks/use-repository";
import { useQueryClient } from "@tanstack/react-query";

export default function RepositoryScreen() {
  const { username, repo } = useLocalSearchParams<{ username: string; repo: string }>();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch, isRefetching } = useRepositoryPageData(username || "", repo || "");
  const toggleStar = useToggleStar(data?.repo.id || "");

  const handleRefresh = () => refetch();

  const handleStar = async () => {
    if (!data) return;
    toggleStar.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(["repository", username, repo, "pageData"], (old: typeof data) => ({
          ...old,
          repo: {
            ...old.repo,
            starred: result.starred,
            starCount: result.starred ? old.repo.starCount + 1 : old.repo.starCount - 1,
          },
        }));
      },
    });
  };

  const getFileIcon = (file: FileEntry): React.ComponentProps<typeof FontAwesome>["name"] => {
    if (file.type === "tree") return "folder";
    const ext = file.name.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "js":
      case "ts":
      case "jsx":
      case "tsx":
        return "file-code-o";
      case "md":
        return "file-text-o";
      default:
        return "file-o";
    }
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

  if (error || !data) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen options={{ title: "Error" }} />
        <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} />
        <View style={styles.card}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.errorContent}>
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text style={styles.errorText}>{error?.message || "Repository not found"}</Text>
          </View>
        </View>
      </View>
    );
  }

  const sortedFiles = [...data.files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "tree" ? -1 : 1;
  });

  return (
    <View style={styles.flex1}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient colors={["#0f0f23", "#1a1a3e", "#0d1b2a"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <ScrollView
        style={styles.flex1}
        contentContainerStyle={styles.scrollContent}
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View style={styles.repoHeaderCard}>
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.repoHeaderContent}>
            <View style={styles.repoTitleRow}>
              <Link href={`/${username}`} asChild>
                <Pressable>
                  <Text style={styles.ownerLink}>{username}</Text>
                </Pressable>
              </Link>
              <Text style={styles.separator}>/</Text>
              <Text style={styles.repoTitle}>{data.repo.name}</Text>
            </View>

            <View style={styles.visibilityRow}>
              <View style={[styles.visibilityBadge, data.repo.visibility === "private" ? styles.privateBadge : styles.publicBadge]}>
                <FontAwesome
                  name={data.repo.visibility === "private" ? "lock" : "globe"}
                  size={10}
                  color={data.repo.visibility === "private" ? "#fbbf24" : "#22c55e"}
                />
                <Text style={[styles.visibilityText, data.repo.visibility === "private" ? styles.privateText : styles.publicText]}>{data.repo.visibility}</Text>
              </View>
            </View>

            {data.repo.description && <Text style={styles.description}>{data.repo.description}</Text>}

            <View style={styles.actionsRow}>
              <Pressable onPress={handleStar} disabled={toggleStar.isPending} style={styles.actionButtonWrapper}>
                <View style={[styles.actionButton, data.repo.starred && styles.starredButton]}>
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={styles.actionButtonInner}>
                    <FontAwesome name={data.repo.starred ? "star" : "star-o"} size={16} color={data.repo.starred ? "#fbbf24" : "#ffffff"} />
                    <Text style={[styles.actionButtonText, data.repo.starred && styles.starredText]}>{data.repo.starCount}</Text>
                  </View>
                </View>
              </Pressable>
              <View style={styles.actionButton}>
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={styles.actionButtonInner}>
                  <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                  <Text style={styles.branchText}>{data.repo.defaultBranch}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.sectionTitle}>Files</Text>

        {data.isEmpty ? (
          <View style={styles.card}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.emptyContent}>
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text style={styles.emptyTitle}>This repository is empty</Text>
              <Text style={styles.emptySubtitle}>Push some code to get started</Text>
            </View>
          </View>
        ) : (
          <View style={styles.filesCard}>
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View style={styles.filesContent}>
              {sortedFiles.map((file, index) => (
                <Pressable key={file.oid} style={[styles.fileRow, index < sortedFiles.length - 1 && styles.fileRowBorder]}>
                  <FontAwesome name={getFileIcon(file)} size={16} color={file.type === "tree" ? "#60a5fa" : "#a78bfa"} />
                  <Text style={styles.fileName}>{file.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {data.readmeOid && (
          <>
            <Text style={styles.sectionTitle}>README</Text>
            <View style={styles.card}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.readmeContent}>
                <View style={styles.readmeHeader}>
                  <FontAwesome name="book" size={14} color="#60a5fa" />
                  <Text style={styles.readmeTitle}>README.md</Text>
                </View>
                <Text style={styles.readmeHint}>Tap to view README content</Text>
              </View>
            </View>
          </>
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
    textAlign: "center",
  },
  repoHeaderCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 24,
  },
  repoHeaderContent: {
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  repoTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  ownerLink: {
    color: "#60a5fa",
    fontSize: 15,
    fontWeight: "500",
  },
  separator: {
    color: "rgba(255, 255, 255, 0.3)",
    marginHorizontal: 4,
    fontSize: 15,
  },
  repoTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "700",
  },
  visibilityRow: {
    flexDirection: "row",
    marginTop: 8,
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
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
    marginLeft: 4,
  },
  privateText: {
    color: "#fbbf24",
  },
  publicText: {
    color: "#22c55e",
  },
  description: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 13,
    marginTop: 12,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: "row",
    marginTop: 16,
  },
  actionButtonWrapper: {
    marginRight: 8,
  },
  actionButton: {
    borderRadius: 10,
    overflow: "hidden",
    backgroundColor: "rgba(60, 60, 90, 0.4)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  starredButton: {
    backgroundColor: "rgba(234, 179, 8, 0.2)",
    borderColor: "rgba(234, 179, 8, 0.3)",
  },
  actionButtonInner: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 8,
    paddingHorizontal: 12,
    position: "relative",
    zIndex: 1,
  },
  actionButtonText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  starredText: {
    color: "#fbbf24",
  },
  branchText: {
    color: "#60a5fa",
    fontSize: 13,
    fontWeight: "600",
    marginLeft: 6,
  },
  sectionTitle: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    marginBottom: 12,
  },
  emptyContent: {
    padding: 32,
    alignItems: "center",
    position: "relative",
    zIndex: 1,
  },
  emptyTitle: {
    color: "rgba(255, 255, 255, 0.5)",
    fontSize: 15,
    fontWeight: "500",
    marginTop: 12,
  },
  emptySubtitle: {
    color: "rgba(255, 255, 255, 0.3)",
    fontSize: 12,
    marginTop: 4,
  },
  filesCard: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
    marginBottom: 24,
  },
  filesContent: {
    position: "relative",
    zIndex: 1,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  fileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  fileName: {
    color: "#ffffff",
    fontSize: 14,
    marginLeft: 12,
    flex: 1,
  },
  readmeContent: {
    padding: 16,
    position: "relative",
    zIndex: 1,
  },
  readmeHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  readmeTitle: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    marginLeft: 8,
  },
  readmeHint: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 12,
    marginTop: 8,
  },
});
