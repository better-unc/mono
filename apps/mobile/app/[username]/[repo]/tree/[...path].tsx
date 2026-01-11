import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { useLocalSearchParams, Link, Stack, RelativePathString } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { type FileEntry } from "@/lib/api";
import { useRepositoryTree, useRepositoryPageData } from "@/lib/hooks/use-repository";

export default function TreeScreen() {
  const { username, repo, path } = useLocalSearchParams<{ username: string; repo: string; path?: string[] }>();

  const { data: repoData } = useRepositoryPageData(username || "", repo || "");
  const defaultBranch = repoData?.repo.defaultBranch || "main";

  const pathArray = path ? (Array.isArray(path) ? path : [path]) : [];
  const branch = pathArray[0] || defaultBranch;
  const dirPath = pathArray.slice(1).join("/");

  const { data, isLoading, error, refetch, isRefetching } = useRepositoryTree(username || "", repo || "", branch, dirPath);

  const handleRefresh = () => refetch();

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
      return `/${username}/${repo}/tree/${branch}/${file.path}`;
    }
    return `/${username}/${repo}/blob/${branch}/${file.path}`;
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center">
        <Stack.Screen
          options={{
            title: dirPath || repo || "",
            headerShown: true,
            headerBackButtonDisplayMode: "minimal",
            headerTransparent: true,
            headerLargeTitle: false,
          }}
        />
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center px-6">
        <Stack.Screen options={{ title: "Error" }} />
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-8 items-center relative z-10">
            <FontAwesome name="exclamation-circle" size={48} color="#f87171" />
            <Text className="text-red-400 text-base mt-4 text-center">{error?.message || "Failed to load directory"}</Text>
          </View>
        </View>
      </View>
    );
  }

  const sortedFiles = [...data.files].sort((a, b) => {
    if (a.type === b.type) return a.name.localeCompare(b.name);
    return a.type === "tree" ? -1 : 1;
  });

  const pathParts = dirPath ? dirPath.split("/").filter(Boolean) : [];
  const displayTitle = pathParts.length > 0 ? pathParts[pathParts.length - 1] : repo || "";

  return (
    <View style={{ flex: 1 }}>
      <Stack.Screen
        options={{ title: displayTitle, headerShown: true, headerBackButtonDisplayMode: "minimal", headerTransparent: true, headerLargeTitle: false }}
      />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="px-4 pt-4 pb-20"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-6">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="p-4 relative z-10">
            <View className="flex-row items-center flex-wrap">
              <Link href={`/${username}/${repo}`} asChild>
                <Pressable>
                  <Text className="text-blue-400 text-[15px] font-medium">{username}</Text>
                </Pressable>
              </Link>
              <Text className="text-gray-400 text-[15px] font-medium mx-1">/</Text>
              <Link href={`/${username}/${repo}`} asChild>
                <Pressable>
                  <Text className="text-blue-400 text-[15px] font-medium">{repo}</Text>
                </Pressable>
              </Link>
              {pathParts.map((part, index) => (
                <View key={index} className="flex-row items-center">
                  <Text className="text-gray-400 text-[15px] font-medium mx-1">/</Text>
                  {index === pathParts.length - 1 ? (
                    <Text className="text-white text-[15px] font-medium">{part}</Text>
                  ) : (
                    <Link href={`/${username}/${repo}/tree/${branch}/${pathParts.slice(0, index + 1).join("/")}`} asChild>
                      <Pressable>
                        <Text className="text-blue-400 text-[15px] font-medium">{part}</Text>
                      </Pressable>
                    </Link>
                  )}
                </View>
              ))}
            </View>
          </View>
        </View>

        {data.isEmpty ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-8 items-center relative z-10">
              <FontAwesome name="inbox" size={32} color="rgba(255,255,255,0.3)" />
              <Text className="text-white/50 text-[15px] font-medium mt-3">This directory is empty</Text>
            </View>
          </View>
        ) : (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
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
      </ScrollView>
    </View>
  );
}
