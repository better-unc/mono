import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet, Alert, Modal, TextInput } from "react-native";
import type { RelativePathString} from "expo-router";
import { useLocalSearchParams, Link, Stack, router } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { type FileEntry, useRepositoryInfo, useRepoTree, useRepoReadmeOid, useRepoReadme, useToggleStar, useForkRepository } from "@gitbruv/hooks";
import { useQueryClient } from "@tanstack/react-query";
import Markdown from "react-native-markdown-display";
import { markdownStyles } from "@/constants/markdownStyles";
import { useEffect, useState } from "react";

export default function RepositoryScreen() {
  const { username, repo: repoName } = useLocalSearchParams<{ username: string; repo: string }>();
  const queryClient = useQueryClient();

  const {
    data: repoInfo,
    isLoading: isLoadingInfo,
    error: infoError,
    refetch: refetchInfo,
    isRefetching: isRefetchingInfo,
  } = useRepositoryInfo(username || "", repoName || "");
  const defaultBranch = repoInfo?.repo.defaultBranch || "main";

  const {
    data: treeData,
    isLoading: isLoadingTree,
    refetch: refetchTree,
    isRefetching: isRefetchingTree,
  } = useRepoTree(username || "", repoName || "", defaultBranch);
  const { data: readmeOidData, isLoading: isLoadingReadmeOid, refetch: refetchReadmeOid } = useRepoReadmeOid(username || "", repoName || "", defaultBranch);
  const { data: readmeData, isLoading: readmeLoading } = useRepoReadme(username || "", repoName || "", readmeOidData?.readmeOid || null);

  const toggleStar = useToggleStar(repoInfo?.repo.id || "");
  const forkRepository = useForkRepository(username || "", repoName || "");
  const [isForkDialogOpen, setIsForkDialogOpen] = useState(false);
  const [forkName, setForkName] = useState("");

  const _isLoading = isLoadingInfo || isLoadingTree;
  const error = infoError;
  const isRefetching = isRefetchingInfo || isRefetchingTree;

  useEffect(() => {
    if (repoInfo?.repo?.name) {
      setForkName(repoInfo.repo.name);
    }
  }, [repoInfo?.repo?.name]);

  const handleRefresh = () => {
    refetchInfo();
    refetchTree();
    refetchReadmeOid();
  };

  const handleStar = async () => {
    if (!repoInfo) return;
    toggleStar.mutate(undefined, {
      onSuccess: (result) => {
        queryClient.setQueryData(["repository", username, repoName, "info"], (old: typeof repoInfo) => {
          if (!old) return old;
          return {
            ...old,
            repo: {
              ...old.repo,
              starred: result.starred,
              starCount: result.starred ? old.repo.starCount + 1 : old.repo.starCount - 1,
            },
          };
        });
      },
    });
  };

  const handleFork = () => {
    if (!repoInfo) return;
    const trimmed = forkName.trim().toLowerCase().replace(/ /g, "-");
    if (!trimmed) {
      Alert.alert("Error", "Repository name is required");
      return;
    }
    if (!/^[a-zA-Z0-9_.-]+$/.test(trimmed)) {
      Alert.alert("Error", "Invalid repository name");
      return;
    }
    forkRepository.mutate({ name: trimmed }, {
      onSuccess: (result) => {
        const forkRepo = result.repo;
        setIsForkDialogOpen(false);
        router.push(`/${forkRepo.owner.username}/${forkRepo.name}` as RelativePathString);
      },
      onError: (err) => {
        Alert.alert("Error", err instanceof Error ? err.message : "Failed to fork repository");
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

  const getFileLink = (file: FileEntry) => {
    if (file.type === "tree") {
      return `/${username}/${repoName}/tree/${defaultBranch}/${file.path}`;
    }
    return `/${username}/${repoName}/blob/${defaultBranch}/${file.path}`;
  };

  if (isLoadingInfo) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center">
        <Stack.Screen options={{ title: "", headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (error || !repoInfo) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center px-6">
        <Stack.Screen options={{ title: "Error" }} />
        <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-8 items-center relative z-10">
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text className="text-red-400 text-base mt-4 text-center">{error?.message || "Repository not found"}</Text>
          </View>
        </View>
      </View>
    );
  }

  const repo = repoInfo.repo;
  const files = treeData?.files || [];
  const isEmpty = treeData?.isEmpty ?? true;
  const readmeOid = readmeOidData?.readmeOid;

  const sortedFiles = [...files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "tree" ? -1 : 1;
  });

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: repo.name, headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-4 relative z-10">
            <View className="flex-row items-center flex-wrap">
              <Link href={`/${username}`} asChild>
                <Pressable>
                  <Text className="text-blue-400 text-[15px] font-medium">{username}</Text>
                </Pressable>
              </Link>
              <Text className="text-gray-400 text-[15px] font-medium mx-1">/</Text>
              <Text className="text-white text-[15px] font-medium">{repo.name}</Text>
            </View>

            <View className="flex-row mt-2">
              <View className={`flex-row items-center px-2 py-1 ${repo.visibility === "private" ? "bg-yellow-500/20" : "bg-green-500/20"}`}>
                <FontAwesome name={repo.visibility === "private" ? "lock" : "globe"} size={10} color={repo.visibility === "private" ? "#fbbf24" : "#22c55e"} />
                <Text className={`text-[11px] font-semibold ml-1 ${repo.visibility === "private" ? "text-yellow-400" : "text-green-500"}`}>
                  {repo.visibility}
                </Text>
              </View>
            </View>

            {repo.description && <Text className="text-white/60 text-[13px] mt-3 leading-5">{repo.description}</Text>}
            {repo.forkedFrom && (
              <View className="flex-row flex-wrap items-center mt-2">
                <Text className="text-white/50 text-[12px]">Forked from </Text>
                <Link href={`/${repo.forkedFrom.owner.username}/${repo.forkedFrom.name}` as RelativePathString} asChild>
                  <Pressable>
                    <Text className="text-blue-400 text-[12px] font-semibold">
                      {repo.forkedFrom.owner.username}/{repo.forkedFrom.name}
                    </Text>
                  </Pressable>
                </Link>
              </View>
            )}

            <View className="flex-row mt-4">
              <Pressable onPress={handleStar} disabled={toggleStar.isPending} className="mr-2">
                <View
                  className={`overflow-hidden border ${
                    repo.starred ? "bg-yellow-500/20 border-yellow-500/30" : "bg-[rgba(60,60,90,0.4)] border-white/10"
                  }`}
                >
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center py-2 px-3 relative z-10">
                    <FontAwesome name={repo.starred ? "star" : "star-o"} size={16} color={repo.starred ? "#fbbf24" : "#ffffff"} />
                    <Text className={`text-[13px] font-semibold ml-1.5 ${repo.starred ? "text-yellow-400" : "text-white"}`}>{repo.starCount}</Text>
                  </View>
                </View>
              </Pressable>
              <Pressable onPress={() => setIsForkDialogOpen(true)} disabled={forkRepository.isPending} className="mr-2">
                <View className="overflow-hidden bg-[rgba(60,60,90,0.4)] border border-white/10">
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center py-2 px-3 relative z-10">
                    <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                    <Text className="text-blue-400 text-[13px] font-semibold ml-1.5">{repo.forkCount || 0}</Text>
                  </View>
                </View>
              </Pressable>
              <View className="overflow-hidden bg-[rgba(60,60,90,0.4)] border border-white/10">
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View className="flex-row items-center py-2 px-3 relative z-10">
                  <FontAwesome name="code" size={16} color="#60a5fa" />
                  <Text className="text-blue-400 text-[13px] font-semibold ml-1.5">{defaultBranch}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text className="text-white text-base font-semibold mb-3">Files</Text>

        {isLoadingTree ? (
          <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <ActivityIndicator size="small" color="#60a5fa" />
            </View>
          </View>
        ) : isEmpty ? (
          <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/50 text-[15px] font-medium mt-3">This repository is empty</Text>
              <Text className="text-white/30 text-xs mt-1">Push some code to get started</Text>
            </View>
          </View>
        ) : (
          <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="relative z-10">
              {sortedFiles.map((file, index) => (
                <Link key={file.oid} href={getFileLink(file) as RelativePathString} asChild>
                  <Pressable className={`flex-row items-center py-3 px-4 ${index < sortedFiles.length - 1 ? "border-b border-white/6" : ""}`}>
                    <FontAwesome name={getFileIcon(file)} size={16} color={file.type === "tree" ? "#60a5fa" : "#a78bfa"} />
                    <Text style={{ flex: 1 }} className="text-white text-sm ml-3">
                      {file.name}
                    </Text>
                    <FontAwesome name="chevron-right" size={12} color="rgba(255,255,255,0.3)" />
                  </Pressable>
                </Link>
              ))}
            </View>
          </View>
        )}

        {isLoadingReadmeOid ? (
          <>
            <Text className="text-white text-base font-semibold mb-3">README</Text>
            <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View className="p-4 relative z-10">
                <View className="flex-row items-center mb-3">
                  <FontAwesome name="book" size={14} color="#60a5fa" />
                  <Text className="text-white text-sm font-semibold ml-2">README.md</Text>
                </View>
                <View className="py-4 items-center">
                  <ActivityIndicator size="small" color="#60a5fa" />
                </View>
              </View>
            </View>
          </>
        ) : readmeOid ? (
          <>
            <Text className="text-white text-base font-semibold mb-3">README</Text>
            <View className="overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View className="p-4 relative z-10">
                <View className="flex-row items-center mb-3">
                  <FontAwesome name="book" size={14} color="#60a5fa" />
                  <Text className="text-white text-sm font-semibold ml-2">README.md</Text>
                </View>
                {readmeLoading ? (
                  <View className="py-4 items-center">
                    <ActivityIndicator size="small" color="#60a5fa" />
                  </View>
                ) : readmeData?.content ? (
                  <ScrollView showsVerticalScrollIndicator={true} className="max-h-[400px]" nestedScrollEnabled={true}>
                    <Markdown style={markdownStyles}>{readmeData.content}</Markdown>
                  </ScrollView>
                ) : (
                  <Text className="text-white/40 text-xs">Failed to load README content</Text>
                )}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
      <Modal
        visible={isForkDialogOpen}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setIsForkDialogOpen(false)}
      >
        <View className="flex-1 items-center justify-center bg-black/60 px-6">
          <View className="w-full overflow-hidden border border-white/10 bg-[rgba(30,30,50,0.9)]">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-5 relative z-10">
              <Text className="text-white text-base font-semibold mb-1">Fork repository</Text>
              <Text className="text-white/60 text-xs mb-4">Choose a name for your fork.</Text>
              <Text className="text-white/80 text-xs mb-2">Repository name</Text>
              <TextInput
                value={forkName}
                onChangeText={setForkName}
                placeholder="my-fork"
                placeholderTextColor="rgba(255,255,255,0.3)"
                className="text-white text-sm px-3 py-2 border border-white/10 bg-white/5"
                autoCapitalize="none"
              />
              <View className="flex-row justify-end mt-4">
                <Pressable onPress={() => setIsForkDialogOpen(false)} className="mr-2">
                  <View className="px-4 py-2 border border-white/10">
                    <Text className="text-white/80 text-xs font-semibold">Cancel</Text>
                  </View>
                </Pressable>
                <Pressable onPress={handleFork} disabled={forkRepository.isPending}>
                  <View className={`px-4 py-2 border border-blue-500 bg-blue-600 ${forkRepository.isPending ? "opacity-60" : ""}`}>
                    <Text className="text-white text-xs font-semibold">{forkRepository.isPending ? "Forking..." : "Fork"}</Text>
                  </View>
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
