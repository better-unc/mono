import { oauthProviderClient } from '@better-auth/oauth-provider/client';
import { passkeyClient } from '@better-auth/passkey/client';
import { createAuthClient } from 'better-auth/react';
import { getApiUrl } from './utils';

export const authClient = createAuthClient({
  baseURL: getApiUrl(),
  plugins: [oauthProviderClient(), passkeyClient()],
});

export const { signIn, signOut, useSession } = authClient;

export async function signUpWithUsername(data: {
  email: string;
  password: string;
  name: string;
  username: string;
}) {
  return authClient.signUp.email(data as Parameters<typeof authClient.signUp.email>[0]);
}
