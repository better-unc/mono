import { serve } from "@hono/node-server";
import { config } from "dotenv";
import { resolve } from "path";

const cwd = process.cwd();
const possiblePaths = [resolve(cwd, ".env"), resolve(cwd, "../.env"), resolve(cwd, "../../.env")];
for (const envPath of possiblePaths) {
  const result = config({ path: envPath });
  if (result.parsed) break;
}

import app from "./index";
import { getEnv } from "./env";

const env = getEnv();
const port = parseInt(env.PORT || "3001", 10);

console.log(`Starting server on port ${port}...`);

serve({
  fetch: app.fetch,
  port,
});

console.log(`Server running at http://localhost:${port}`);
