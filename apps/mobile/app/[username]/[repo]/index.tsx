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
import { type FileEntry } from "@/lib/api";
import { GlassCard, GlassButton, GlassGroup } from "@/components/ui/glass";
import { useRepositoryPageData, useToggleStar } from "@/lib/hooks/use-repository";
import { useQueryClient } from "@tanstack/react-query";

export default function RepositoryScreen() {
  const { username, repo } = useLocalSearchParams<{
    username: string;
    repo: string;
  }>();
  const queryClient = useQueryClient();

  const {
    data,
    isLoading,
    error,
    refetch,
    isRefetching,
  } = useRepositoryPageData(username || "", repo || "");

  const toggleStar = useToggleStar(data?.repo.id || "");

  const handleRefresh = () => {
    refetch();
  };

  const handleStar = async () => {
    if (!data) return;
    toggleStar.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(
          ["repository", username, repo, "pageData"],
          (old: typeof data) => ({
            ...old,
            repo: {
              ...old.repo,
              starred: result.starred,
              starCount: result.starred
                ? old.repo.starCount + 1
                : old.repo.starCount - 1,
            },
          })
        );
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
      case "json":
        return "file-o";
      default:
        return "file-o";
    }
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

  if (error || !data) {
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
            {error?.message || "Repository not found"}
          </Text>
        </GlassCard>
      </View>
    );
  }

  const sortedFiles = [...data.files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "tree" ? -1 : 1;
  });

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: data.repo.name }} />
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
        <GlassCard style={styles.headerCard}>
          <View style={styles.repoNameRow}>
            <Link href={`/${username}`} asChild>
              <Pressable>
                <Text style={styles.ownerName}>{username}</Text>
              </Pressable>
            </Link>
            <Text style={styles.separator}>/</Text>
            <Text style={styles.repoName}>{data.repo.name}</Text>
          </View>

          <View style={styles.badgeRow}>
            <View
              style={[
                styles.visibilityBadge,
                data.repo.visibility === "private"
                  ? styles.privateBadge
                  : styles.publicBadge,
              ]}
            >
              <FontAwesome
                name={data.repo.visibility === "private" ? "lock" : "globe"}
                size={10}
                color={data.repo.visibility === "private" ? "#fbbf24" : "#22c55e"}
              />
              <Text
                style={[
                  styles.visibilityText,
                  data.repo.visibility === "private"
                    ? styles.privateText
                    : styles.publicText,
                ]}
              >
                {data.repo.visibility}
              </Text>
            </View>
          </View>

          {data.repo.description && (
            <Text style={styles.description}>{data.repo.description}</Text>
          )}

          <GlassGroup style={styles.actionRow} spacing={8}>
            <Pressable onPress={handleStar} disabled={toggleStar.isPending}>
              <GlassButton
                style={styles.actionButton}
                interactive
                tintColor={data.repo.starred ? "#eab308" : undefined}
              >
                <FontAwesome
                  name={data.repo.starred ? "star" : "star-o"}
                  size={16}
                  color={data.repo.starred ? "#fbbf24" : "#ffffff"}
                />
                <Text
                  style={[
                    styles.actionText,
                    data.repo.starred && styles.starredText,
                  ]}
                >
                  {data.repo.starCount}
                </Text>
              </GlassButton>
            </Pressable>

            <GlassButton style={styles.actionButton}>
              <FontAwesome name="code-fork" size={16} color="#60a5fa" />
              <Text style={styles.branchText}>{data.repo.defaultBranch}</Text>
            </GlassButton>
          </GlassGroup>
        </GlassCard>

        <Text style={styles.sectionTitle}>Files</Text>

        {data.isEmpty ? (
          <GlassCard style={styles.emptyCard}>
            <FontAwesome
              name="inbox"
              size={32}
              color="rgba(255,255,255,0.3)"
            />
            <Text style={styles.emptyText}>This repository is empty</Text>
            <Text style={styles.emptyHint}>
              Push some code to get started
            </Text>
          </GlassCard>
        ) : (
          <GlassCard style={styles.filesCard}>
            {sortedFiles.map((file, index) => (
              <Pressable
                key={file.oid}
                style={({ pressed }) => [
                  styles.fileRow,
                  index < sortedFiles.length - 1 && styles.fileRowBorder,
                  pressed && styles.fileRowPressed,
                ]}
              >
                <View
                  style={[
                    styles.fileIconContainer,
                    file.type === "tree"
                      ? styles.folderIconBg
                      : styles.fileIconBg,
                  ]}
                >
                  <FontAwesome
                    name={getFileIcon(file)}
                    size={14}
                    color={file.type === "tree" ? "#60a5fa" : "#a78bfa"}
                  />
                </View>
                <Text style={styles.fileName}>{file.name}</Text>
                <FontAwesome
                  name="chevron-right"
                  size={12}
                  color="rgba(255, 255, 255, 0.3)"
                />
              </Pressable>
            ))}
          </GlassCard>
        )}

        {data.readmeOid && (
          <>
            <Text style={styles.sectionTitle}>README</Text>
            <GlassCard style={styles.readmeCard}>
              <View style={styles.readmeHeader}>
                <FontAwesome name="book" size={14} color="#60a5fa" />
                <Text style={styles.readmeTitle}>README.md</Text>
              </View>
              <Text style={styles.readmeHint}>
                Tap to view README content
              </Text>
            </GlassCard>
          </>
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
    textAlign: "center",
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
    paddingBottom: 40,
  },
  headerCard: {
    padding: 20,
    marginBottom: 24,
  },
  repoNameRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
  },
  ownerName: {
    fontSize: 16,
    color: "#60a5fa",
    fontWeight: "500",
  },
  separator: {
    fontSize: 16,
    color: "rgba(255, 255, 255, 0.4)",
    marginHorizontal: 6,
  },
  repoName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#ffffff",
  },
  badgeRow: {
    flexDirection: "row",
    marginTop: 10,
  },
  visibilityBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  privateBadge: {
    backgroundColor: "rgba(251, 191, 36, 0.15)",
  },
  publicBadge: {
    backgroundColor: "rgba(34, 197, 94, 0.15)",
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: "600",
  },
  privateText: {
    color: "#fbbf24",
  },
  publicText: {
    color: "#22c55e",
  },
  description: {
    fontSize: 14,
    color: "rgba(255, 255, 255, 0.7)",
    marginTop: 14,
    lineHeight: 20,
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 18,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  actionText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
  },
  starredText: {
    color: "#fbbf24",
  },
  branchText: {
    color: "#60a5fa",
    fontSize: 14,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 12,
  },
  emptyCard: {
    padding: 40,
    alignItems: "center",
  },
  emptyText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 16,
    marginTop: 16,
    fontWeight: "500",
  },
  emptyHint: {
    color: "rgba(255, 255, 255, 0.4)",
    fontSize: 13,
    marginTop: 6,
  },
  filesCard: {
    padding: 0,
    overflow: "hidden",
    marginBottom: 24,
  },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  fileRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: "rgba(255, 255, 255, 0.06)",
  },
  fileRowPressed: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  fileIconContainer: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  folderIconBg: {
    backgroundColor: "rgba(96, 165, 250, 0.15)",
  },
  fileIconBg: {
    backgroundColor: "rgba(167, 139, 250, 0.15)",
  },
  fileName: {
    fontSize: 14,
    color: "#ffffff",
    flex: 1,
  },
  readmeCard: {
    padding: 16,
  },
  readmeHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  readmeTitle: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  readmeHint: {
    fontSize: 13,
    color: "rgba(255, 255, 255, 0.5)",
    marginTop: 8,
  },
});
