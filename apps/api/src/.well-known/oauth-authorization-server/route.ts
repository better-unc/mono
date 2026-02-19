import { getAuth } from '../../auth';
import { Hono } from 'hono';

const app = new Hono();

app.get('/', async (c) => {
  const auth = getAuth();

  const baseURL = auth.options.baseURL || '';
  const config = {
    issuer: baseURL,
    authorization_endpoint: `${baseURL}/oauth2/authorize`,
    token_endpoint: `${baseURL}/oauth2/token`,
    jwks_uri: `${baseURL}/jwks`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token', 'client_credentials'],
    subject_types_supported: ['public'],
    id_token_signing_alg_values_supported: ['RS256', 'HS256'],
    scopes_supported: ['openid', 'profile', 'email', 'offline_access', 'read:user', 'write:user'],
    token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
    code_challenge_methods_supported: ['S256'],
    registration_endpoint: `${baseURL}/oauth2/register`,
    end_session_endpoint: `${baseURL}/oauth2/end-session`,
    introspection_endpoint: `${baseURL}/oauth2/introspect`,
    revocation_endpoint: `${baseURL}/oauth2/revoke`,
  };

  return c.json(config);
});

export default app;
