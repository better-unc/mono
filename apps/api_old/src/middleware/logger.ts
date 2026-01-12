import { type MiddlewareHandler } from "hono";
import { type AppEnv } from "../types";

const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
};

const methodColors: Record<string, string> = {
  GET: colors.green,
  POST: colors.blue,
  PUT: colors.yellow,
  PATCH: colors.yellow,
  DELETE: colors.red,
  OPTIONS: colors.dim,
  HEAD: colors.dim,
};

const statusColor = (status: number): string => {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  if (status >= 200) return colors.green;
  return colors.dim;
};

const formatDuration = (ms: number): string => {
  if (ms < 1) return `${(ms * 1000).toFixed(0)}µs`;
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
};

let requestCounter = 0;

export const loggerMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const start = performance.now();
  const requestId = ++requestCounter;
  const method = c.req.method;
  const path = c.req.path;
  const query = c.req.query();
  const queryString = Object.keys(query).length > 0 ? `?${new URLSearchParams(query).toString()}` : "";

  const methodColor = methodColors[method] || colors.dim;
  const timestamp = new Date().toISOString();

  console.log(
    `${colors.dim}[${timestamp}]${colors.reset} ` + `${methodColor}${method.padEnd(7)}${colors.reset} ` + `${path}${colors.dim}${queryString}${colors.reset}`
  );

  try {
    await next();
  } catch (err) {
    const duration = performance.now() - start;
    const error = err as Error;

    console.error(
      `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
        `${colors.red}ERROR${colors.reset} ` +
        `${path} ${colors.dim}${formatDuration(duration)}${colors.reset}`
    );
    console.error(`${colors.red}${error.stack || error.message}${colors.reset}`);

    throw err;
  }

  const duration = performance.now() - start;
  const status = c.res.status;
  const sColor = statusColor(status);

  console.log(
    `${colors.dim}[${new Date().toISOString()}]${colors.reset} ` +
      `${sColor}${status}${colors.reset} ` +
      `    ${path} ${colors.dim}${formatDuration(duration)}${colors.reset}`
  );
};

export const errorHandler: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const error = err as Error;
    console.error(`${colors.red}[UNHANDLED ERROR]${colors.reset}`, error.stack || error.message);
    console.error("Error details:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
      path: c.req.path,
      method: c.req.method,
    });
    return c.text(`Internal Server Error: ${error.message}`, 500);
  }
};
