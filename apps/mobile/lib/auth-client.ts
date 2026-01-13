import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { expoClient } from "@better-auth/expo/client";

const AUTH_URL = process.env.EXPO_PUBLIC_AUTH_URL || "http://localhost:3000";

export const authClient = createAuthClient({
  baseURL: AUTH_URL,
  plugins: [
    expoClient({
      scheme: "exp",
      storagePrefix: "exp",
      storage: SecureStore,
    }),
  ],
});

export const { signIn, signOut, useSession } = authClient;

export async function signUpWithUsername(data: { email: string; password: string; name: string; username: string }) {
  return authClient.signUp.email(data as Parameters<typeof authClient.signUp.email>[0]);
}
