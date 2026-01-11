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
      <View className="flex-1 items-center justify-center">
        <Stack.Screen options={{ title: "", headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }} />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View className="flex-1 items-center justify-center px-6">
        <Stack.Screen options={{ title: "Error" }} />
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-8 items-center relative z-10">
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text className="text-red-400 text-base mt-4 text-center">{error?.message || "Repository not found"}</Text>
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
    <View className="flex-1">
      <Stack.Screen
        options={{ title: data.repo.name, headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }}
      />
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 px-4 pt-4 pb-20"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-4 relative z-10">
            <View className="flex-row items-center flex-wrap">
              <Link href={`/${username}`} asChild>
                <Pressable>
                  <Text className="text-blue-400 text-[15px] font-medium">{username}</Text>
                </Pressable>
              </Link>
              <Text className="text-gray-400 text-sm mx-1">/</Text>
              <Text className="text-white text-sm font-medium">{data.repo.name}</Text>
            </View>

            <View className="flex-row mt-2">
              <View className={`flex-row items-center px-2 py-1 rounded-xl ${data.repo.visibility === "private" ? "bg-yellow-500/20" : "bg-green-500/20"}`}>
                <FontAwesome
                  name={data.repo.visibility === "private" ? "lock" : "globe"}
                  size={10}
                  color={data.repo.visibility === "private" ? "#fbbf24" : "#22c55e"}
                />
                <Text className={`text-[11px] font-semibold ml-1 ${data.repo.visibility === "private" ? "text-yellow-400" : "text-green-500"}`}>
                  {data.repo.visibility}
                </Text>
              </View>
            </View>

            {data.repo.description && <Text className="text-white/60 text-[13px] mt-3 leading-5">{data.repo.description}</Text>}

            <View className="flex-row mt-4">
              <Pressable onPress={handleStar} disabled={toggleStar.isPending} className="mr-2">
                <View
                  className={`rounded-[10px] overflow-hidden border ${
                    data.repo.starred ? "bg-yellow-500/20 border-yellow-500/30" : "bg-[rgba(60,60,90,0.4)] border-white/10"
                  }`}
                >
                  <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center py-2 px-3 relative z-10">
                    <FontAwesome name={data.repo.starred ? "star" : "star-o"} size={16} color={data.repo.starred ? "#fbbf24" : "#ffffff"} />
                    <Text className={`text-[13px] font-semibold ml-1.5 ${data.repo.starred ? "text-yellow-400" : "text-white"}`}>{data.repo.starCount}</Text>
                  </View>
                </View>
              </Pressable>
              <View className="rounded-[10px] overflow-hidden bg-[rgba(60,60,90,0.4)] border border-white/10">
                <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
                <View className="flex-row items-center py-2 px-3 relative z-10">
                  <FontAwesome name="code-fork" size={16} color="#60a5fa" />
                  <Text className="text-blue-400 text-[13px] font-semibold ml-1.5">{data.repo.defaultBranch}</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        <Text className="text-white text-base font-semibold mb-3">Files</Text>

        {data.isEmpty ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/50 text-[15px] font-medium mt-3">This repository is empty</Text>
              <Text className="text-white/30 text-xs mt-1">Push some code to get started</Text>
            </View>
          </View>
        ) : (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="relative z-10">
              {sortedFiles.map((file, index) => (
                <Pressable key={file.oid} className={`flex-row items-center py-3 px-4 ${index < sortedFiles.length - 1 ? "border-b border-white/6" : ""}`}>
                  <FontAwesome name={getFileIcon(file)} size={16} color={file.type === "tree" ? "#60a5fa" : "#a78bfa"} />
                  <Text className="text-white text-sm ml-3 flex-1">{file.name}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {data.readmeOid && (
          <>
            <Text className="text-white text-base font-semibold mb-3">README</Text>
            <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View className="p-4 relative z-10">
                <View className="flex-row items-center">
                  <FontAwesome name="book" size={14} color="#60a5fa" />
                  <Text className="text-white text-sm font-semibold ml-2">README.md</Text>
                </View>
                <Text className="text-white/40 text-xs mt-2">Tap to view README content</Text>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}
