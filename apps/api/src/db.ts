import { db, type Database } from "@gitbruv/db";
import { config } from "./config";

export { db };
export type { Database };

export const getDatabase = (): Database => {
  if (!config.databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  return db;
};
