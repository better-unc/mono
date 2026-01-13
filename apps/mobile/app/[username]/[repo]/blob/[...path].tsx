import { View, Text, ScrollView, RefreshControl, ActivityIndicator, StyleSheet, Pressable } from "react-native";
import { useLocalSearchParams, Link, Stack } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { BlurView } from "expo-blur";
import { useRepoFile, useRepoPageData } from "@gitbruv/hooks";
import { CodeViewer, getLanguage } from "@/components/code-viewer";

export default function BlobScreen() {
  const { username, repo, path } = useLocalSearchParams<{ username: string; repo: string; path?: string[] }>();

  const { data: repoData } = useRepoPageData(username || "", repo || "");
  const defaultBranch = repoData?.repo.defaultBranch || "main";

  const pathArray = path ? (Array.isArray(path) ? path : [path]) : [];
  const branch = pathArray[0] || defaultBranch;
  const filePath = pathArray.slice(1).join("/");

  const { data, isLoading, error, refetch, isRefetching } = useRepoFile(username || "", repo || "", branch, filePath);

  const handleRefresh = () => refetch();

  if (isLoading) {
    return (
      <View style={{ flex: 1 }} className="items-center justify-center">
        <Stack.Screen
          options={{
            title: filePath.split("/").pop() || repo || "",
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
            <Text className="text-red-400 text-base mt-4 text-center">{error?.message || "Failed to load file"}</Text>
          </View>
        </View>
      </View>
    );
  }

  const pathParts = filePath.split("/").filter(Boolean);
  const fileName = pathParts[pathParts.length - 1] || filePath;
  const displayTitle = fileName;
  const language = getLanguage(fileName);

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
              {pathParts.map((part, index) => {
                if (index === pathParts.length - 1) {
                  return (
                    <View key={index} className="flex-row items-center">
                      <Text className="text-gray-400 text-[15px] font-medium mx-1">/</Text>
                      <Text className="text-white text-[15px] font-medium">{part}</Text>
                    </View>
                  );
                }
                const dirPath = pathParts.slice(0, index + 1).join("/");
                return (
                  <View key={index} className="flex-row items-center">
                    <Text className="text-gray-400 text-[15px] font-medium mx-1">/</Text>
                    <Link href={`/${username}/${repo}/tree/${branch}/${dirPath}`} asChild>
                      <Pressable>
                        <Text className="text-blue-400 text-[15px] font-medium">{part}</Text>
                      </Pressable>
                    </Link>
                  </View>
                );
              })}
            </View>
          </View>
        </View>

        <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View className="relative z-10">
            <CodeViewer content={data.content} language={language} filename={fileName} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}
