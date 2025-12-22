import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { accounts, repositories, users } from "./schema";
import { or, like, inArray, sql } from "drizzle-orm";

const BLACKLISTED_PATTERNS = ["tempmail", "guerrilla", "mailinator", "10minutemail", "throwaway", "faggot"];

const BLACKLISTED_PATTERNS_REPOS = ["test"];

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error("DATABASE_URL not found in environment");
    process.exit(1);
  }

  const client = postgres(connectionString);
  const db = drizzle(client);

  const userIdsToDelete = await db
    .select({ id: users.id, email: users.email })
    .from(users)
    .where(or(...BLACKLISTED_PATTERNS.map((pattern) => like(users.email, `%${pattern}%`)))!);

  const repoIdsToDelete = await db
    .select({ id: repositories.id })
    .from(repositories)
    .where(or(...BLACKLISTED_PATTERNS_REPOS.map((pattern) => like(repositories.name, `%${pattern}%`)))!);

  if (repoIdsToDelete.length !== 0) {
    const repositoriesToDelete = await db
      .delete(repositories)
      .where(
        inArray(
          repositories.id,
          repoIdsToDelete.map((r) => r.id)
        )
      )
      .returning({ id: repositories.id });

    console.log(`Deleted ${repositoriesToDelete.length} repositories`);
  }

  if (userIdsToDelete.length !== 0) {
    const accountsToDelete = await db
      .delete(accounts)
      .where(
        inArray(
          accounts.userId,
          userIdsToDelete.map((u) => u.id)
        )
      )
      .returning({ id: accounts.id });

    const usersToDelete = await db
      .delete(users)
      .where(
        inArray(
          users.id,
          userIdsToDelete.map((u) => u.id)
        )
      )
      .returning({ id: users.id });

    console.log(`Deleted ${accountsToDelete.length} accounts`);
    console.log(`Deleted ${usersToDelete.length} users`);
  }

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
