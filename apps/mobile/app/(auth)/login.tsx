import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { signIn } from "@/lib/auth-client";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    setLoading(true);

    try {
      await signIn.email({ email, password });
    } catch (err) {
      Alert.alert("Error", `Network error: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerClassName="justify-center px-6" keyboardShouldPersistTaps="handled">
            <View className="items-center mb-8">
              <View className="w-[72px] h-[72px] bg-blue-600 items-center justify-center mb-5">
                <FontAwesome name="code-fork" size={36} color="white" />
              </View>
              <Text className="text-white text-3xl font-bold mb-2">Welcome back</Text>
              <Text className="text-gray-400 text-base">Sign in to your GitBruv account</Text>
            </View>

            <View className="bg-gray-800/50 border border-gray-700/50 overflow-hidden">
              <View className="p-6">
                <View className="mb-5">
                  <Text className="text-gray-200 text-sm font-semibold mb-2">Email</Text>
                  <View className="flex-row items-center bg-white/5 border border-gray-700/50">
                    <View className="pl-4">
                      <FontAwesome name="envelope" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={{ flex: 1 }}
                      className="py-3.5 px-3 text-base text-white"
                      placeholder="you@example.com"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      value={email}
                      onChangeText={setEmail}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      autoComplete="email"
                    />
                  </View>
                </View>

                <View className="mb-5">
                  <Text className="text-gray-200 text-sm font-semibold mb-2">Password</Text>
                  <View className="flex-row items-center bg-white/5 border border-gray-700/50">
                    <View className="pl-4">
                      <FontAwesome name="lock" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={{ flex: 1 }}
                      className="py-3.5 px-3 text-base text-white"
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} className="p-3.5">
                      <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={18} color="rgba(255, 255, 255, 0.4)" />
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={handleLogin} disabled={loading}>
                  <View className={`py-4 items-center mt-2 bg-blue-600 border border-blue-500 ${loading ? "opacity-60" : ""}`}>
                    <Text className="text-white text-base font-semibold">{loading ? "Signing in..." : "Sign In"}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-400 text-base">Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text className="text-blue-400 text-base font-semibold">Sign up</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
