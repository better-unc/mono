import { useState } from "react";
import { View, Text, TextInput, Pressable, KeyboardAvoidingView, Platform, ScrollView, Alert, StyleSheet } from "react-native";
import { Link, router } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import FontAwesome from "@expo/vector-icons/FontAwesome";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
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
      const result = await signIn.email({ email, password });
      if (result.error) {
        Alert.alert("Error", result.error.message || "Login failed");
      } else {
        router.replace("/(tabs)");
      }
    } catch {
      Alert.alert("Error", "An unexpected error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.flex1}>
      <LinearGradient colors={["#0a0a1a", "#1a0a2e", "#0a1a2e"]} style={StyleSheet.absoluteFill} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} />
      <SafeAreaView style={styles.flex1}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.flex1}>
          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.header}>
              <LinearGradient colors={["#3b82f6", "#8b5cf6"]} style={styles.logoGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
                <FontAwesome name="code-fork" size={36} color="white" />
              </LinearGradient>
              <Text style={styles.title}>Welcome back</Text>
              <Text style={styles.subtitle}>Sign in to your GitBruv account</Text>
            </View>

            <View style={styles.card}>
              <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
              <View style={styles.cardContent}>
                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Email</Text>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIcon}>
                      <FontAwesome name="envelope" size={16} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={styles.input}
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

                <View style={styles.inputGroup}>
                  <Text style={styles.label}>Password</Text>
                  <View style={styles.inputContainer}>
                    <View style={styles.inputIcon}>
                      <FontAwesome name="lock" size={18} color="rgba(255,255,255,0.4)" />
                    </View>
                    <TextInput
                      style={styles.input}
                      placeholder="••••••••"
                      placeholderTextColor="rgba(255, 255, 255, 0.3)"
                      value={password}
                      onChangeText={setPassword}
                      secureTextEntry={!showPassword}
                      autoComplete="password"
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                      <FontAwesome name={showPassword ? "eye-slash" : "eye"} size={18} color="rgba(255, 255, 255, 0.4)" />
                    </Pressable>
                  </View>
                </View>

                <Pressable onPress={handleLogin} disabled={loading}>
                  <View style={[styles.submitButton, loading && styles.submitButtonDisabled]}>
                    <BlurView intensity={30} tint="light" style={StyleSheet.absoluteFill} />
                    <Text style={styles.submitButtonText}>{loading ? "Signing in..." : "Sign In"}</Text>
                  </View>
                </Pressable>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" asChild>
                <Pressable>
                  <Text style={styles.footerLink}>Sign up</Text>
                </Pressable>
              </Link>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  header: {
    alignItems: "center",
    marginBottom: 32,
  },
  logoGradient: {
    width: 72,
    height: 72,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  title: {
    color: "#ffffff",
    fontSize: 28,
    fontWeight: "700",
    marginBottom: 8,
  },
  subtitle: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
  },
  card: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "rgba(30, 30, 50, 0.5)",
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  cardContent: {
    padding: 24,
    position: "relative",
    zIndex: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255, 255, 255, 0.08)",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.1)",
  },
  inputIcon: {
    paddingLeft: 16,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 16,
    color: "#ffffff",
  },
  eyeButton: {
    padding: 14,
  },
  submitButton: {
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 8,
    overflow: "hidden",
    backgroundColor: "rgba(59, 130, 246, 0.3)",
    borderWidth: 1,
    borderColor: "rgba(59, 130, 246, 0.4)",
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#ffffff",
    fontSize: 16,
    fontWeight: "600",
    position: "relative",
    zIndex: 1,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 32,
  },
  footerText: {
    color: "rgba(255, 255, 255, 0.6)",
    fontSize: 15,
  },
  footerLink: {
    color: "#60a5fa",
    fontSize: 15,
    fontWeight: "600",
  },
});
