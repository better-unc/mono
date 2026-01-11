import { View, Text, ScrollView, RefreshControl, Pressable, ActivityIndicator, StyleSheet } from "react-native";
import { Link } from "expo-router";
import FontAwesome from "@expo/vector-icons/FontAwesome";
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
      <View style={{ flex: 1 }} className="items-center justify-center">
        <ActivityIndicator size="large" color="#60a5fa" />
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerClassName="px-4 py-4"
        contentInsetAdjustmentBehavior="automatic"
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={handleRefresh} tintColor="#60a5fa" />}
      >
        {session?.user ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-3">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-5 relative z-10">
              <Text className="text-white text-xl font-bold mb-1">Welcome back, {session.user.name}!</Text>
              <Text className="text-white/60 text-sm">Check out the latest repositories below</Text>
            </View>
          </View>
        ) : (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-blue-500/30 mb-3">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-5 relative z-10">
              <Text className="text-white text-xl font-bold mb-1">Welcome to GitBruv</Text>
              <Text className="text-white/60 text-sm">Sign in to start exploring and creating repositories</Text>
              <Link href="/(auth)/login" asChild>
                <Pressable className="mt-4 py-3 px-6 rounded-xl self-start overflow-hidden bg-blue-600/30">
                  <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                  <Text className="text-white font-semibold text-[15px] relative z-10">Sign In</Text>
                </Pressable>
              </Link>
            </View>
          </View>
        )}

        <Text className="text-white text-lg font-semibold mb-4 mt-2">Recent Repositories</Text>

        {repos.length === 0 ? (
          <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10 mb-3">
            <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
            <View className="p-6 items-center relative z-10">
              <Text className="text-white/60 text-[15px]">No repositories found</Text>
            </View>
          </View>
        ) : (
          repos.map((repo) => (
            <Link key={repo.id} href={`/${repo.owner.username}/${repo.name}`} asChild>
              <Pressable className="mb-3">
                <View className="rounded-2xl overflow-hidden bg-[rgba(30,30,50,0.5)] border border-white/10">
                  <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
                  <View className="flex-row items-center p-4 relative z-10">
                    <View className="w-10 h-10 rounded-full bg-blue-500/20 items-center justify-center mr-3">
                      <FontAwesome name="code-fork" size={18} color="#60a5fa" />
                    </View>
                    <View style={{ flex: 1 }} className="mr-3">
                      <Text className="text-white text-[15px] font-semibold">
                        {repo.owner.username}/{repo.name}
                      </Text>
                      {repo.description && (
                        <Text className="text-white/50 text-[13px] mt-1" numberOfLines={1}>
                          {repo.description}
                        </Text>
                      )}
                    </View>
                    <View className="flex-row items-center bg-yellow-500/20 px-2.5 py-1.5 rounded-xl">
                      <FontAwesome name="star" size={12} color="#fbbf24" />
                      <Text className="text-yellow-400 text-xs font-semibold ml-1">{repo.starCount}</Text>
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
