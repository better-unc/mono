import { handleWebSocketUpgrade, websocketHandlers } from './websocket';
import { config, getAllowedOrigins } from './config';
import { createMiddleware } from 'hono/factory';
import { mountRoutes } from './routes';
import { initAuth } from './auth';
import { cors } from 'hono/cors';
import { Hono } from 'hono';

const app = new Hono();

const loggingMiddleware = createMiddleware(async (c, next) => {
  await next();
});

app.use('*', loggingMiddleware);

app.use(
  '*',
  cors({
    origin: getAllowedOrigins(),
    credentials: true,
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'Cookie', 'x-internal-auth'],
    exposeHeaders: ['Set-Cookie'],
  }),
);

app.use(
  '*',
  createMiddleware(async (c, next) => {
    await initAuth();
    await next();
  }),
);

mountRoutes(app);

const port = config.port;

export default {
  port,
  fetch: async (request: Request, server: any) => {
    const wsResponse = await handleWebSocketUpgrade(request, server);
    if (wsResponse !== undefined) {
      return wsResponse;
    }

    return app.fetch(request);
  },
  websocket: websocketHandlers,
  idleTimeout: 255,
};
