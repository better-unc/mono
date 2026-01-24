import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { signUpWithUsername } from "@/lib/auth-client";
import { validateUsername, validatePassword } from "@gitbruv/lib";

export default function RegisterScreen() {
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleRegister = async () => {
    if (!name || !username || !email || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.valid) {
      Alert.alert("Error", usernameValidation.error);
      return;
    }

    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      Alert.alert("Error", passwordValidation.error);
      return;
    }

    setLoading(true);
    try {
      await signUpWithUsername({ email, password, name, username });
    } catch {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
          <ScrollView contentContainerClassName="justify-center px-6 py-6" keyboardShouldPersistTaps="handled">
            <View className="items-center mb-8">
              <View className="w-[72px] h-[72px] bg-purple-600 items-center justify-center mb-5">
                <FontAwesome name="user-plus" size={32} color="white" />
              </View>
              <Text className="text-white text-3xl font-bold mb-2">Create account</Text>
              <Text className="text-gray-400 text-base">Join the GitBruv community</Text>
            </View>

            <View className="bg-gray-800/50 border border-gray-700/50 overflow-hidden">
              <View className="p-6">
                <View className="mb-5">
                  <Text className="text-gray-200 text-sm font-semibold mb-2">Name</Text>
                  <View className="flex-row items-center bg-white/5 border border-gray-700/50">
                    <View className="pl-4">
                      <FontAwesome name="user" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={{ flex: 1 }}
                      className="py-3.5 px-3 text-base text-white"
                      placeholder="John Doe"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      value={name}
                      onChangeText={setName}
                      autoCapitalize="words"
                      autoComplete="name"
                    />
                  </View>
                </View>

                <View className="mb-5">
                  <Text className="text-gray-200 text-sm font-semibold mb-2">Username</Text>
                  <View className="flex-row items-center bg-white/5 border border-gray-700/50">
                    <View className="pl-4">
                      <FontAwesome name="at" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={{ flex: 1 }}
                      className="py-3.5 px-3 text-base text-white"
                      placeholder="johndoe"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      value={username}
                      onChangeText={setUsername}
                      autoCapitalize="none"
                      autoComplete="username"
                    />
                  </View>
                </View>

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
                      autoComplete="password-new"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} className="p-3.5">
                      <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={18} color="rgba(255, 255, 255, 0.4)" />
                    </Pressable>
                  </View>
                  <Text className="text-gray-500 text-xs mt-2">At least 8 characters</Text>
                </View>

                <Pressable onPress={handleRegister} disabled={loading}>
                  <View className={`py-4 items-center mt-2 bg-purple-600 border border-purple-500 ${loading ? "opacity-60" : ""}`}>
                    <Text className="text-white text-base font-semibold">{loading ? "Creating account..." : "Create Account"}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View className="flex-row justify-center mt-8">
              <Text className="text-gray-400 text-base">Already have an account? </Text>
              <Link href="/(auth)/login" asChild>
                <Pressable>
                  <Text className="text-blue-400 text-base font-semibold">Sign in</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
