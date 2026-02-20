import { betterAuth } from 'better-auth';
import { genericOAuth } from 'better-auth/plugins';
import Database from 'better-sqlite3';

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? 'http://localhost:3001',
  secret: process.env.BETTER_AUTH_SECRET!,
  database: new Database('./oauth-test.db'),
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
      },
    },
  },
  plugins: [
    genericOAuth({
      config: [
        {
          providerId: 'gitbruv',
          clientId: process.env.GITBRUV_CLIENT_ID!,
          clientSecret: process.env.GITBRUV_CLIENT_SECRET!,
          authorizationUrl: `${process.env.GITBRUV_API_URL}/api/auth/oauth2/authorize`,
          tokenUrl: `${process.env.GITBRUV_API_URL}/api/auth/oauth2/token`,
          userInfoUrl: `${process.env.GITBRUV_API_URL}/api/auth/oauth2/userinfo`,
          scopes: ['openid', 'profile', 'email'],
          pkce: true,
          mapProfileToUser: (profile: Record<string, unknown>) => ({
            name: profile.name as string,
            email: profile.email as string,
            image: profile.picture as string,
            username: profile.username as string,
          }),
        },
      ],
    }),
  ],
});
