import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/server.ts"],
  format: ["esm"],
  target: "node22",
  outDir: "dist",
  clean: true,
  splitting: false,
  sourcemap: true,
  dts: false,
  noExternal: ["@gitbruv/auth", "@gitbruv/db"],
  external: ["bun", "dotenv", "@aws-sdk/client-s3", "bcryptjs", "drizzle-orm", "hono", "isomorphic-git", "postgres"],
});
