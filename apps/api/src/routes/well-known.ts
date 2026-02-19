import oauthAuthServer from '../.well-known/oauth-authorization-server/route';
import openidConfig from '../.well-known/openid-configuration/route';
import { Hono } from 'hono';

const app = new Hono();

app.route('/.well-known/openid-configuration', openidConfig);
app.route('/.well-known/oauth-authorization-server', oauthAuthServer);

export default app;
