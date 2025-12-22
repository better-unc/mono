import { createDatabase, type Database } from "@gitbruv/db";

export { type Database };
export { users, accounts, repositories, stars } from "@gitbruv/db";

export function createDb(connectionString: string): Database {
  return createDatabase(connectionString);
}
