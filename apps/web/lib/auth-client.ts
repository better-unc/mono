import { createAuthClient } from "better-auth/react";
import { apiKeyClient } from "better-auth/client/plugins";
import { getApiUrl } from "./utils";
import { passkeyClient } from "@better-auth/passkey/client";

export const authClient = createAuthClient({
  baseURL: getApiUrl(),
  plugins: [apiKeyClient(), passkeyClient()],
});

export const { signIn, signOut, useSession } = authClient;

export async function signUpWithUsername(data: { email: string; password: string; name: string; username: string }) {
  return authClient.signUp.email(data as Parameters<typeof authClient.signUp.email>[0]);
}
