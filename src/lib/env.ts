export type ServerEnvironment = Record<string, string | undefined>;

export function getDatabaseUrl(environment: ServerEnvironment = process.env): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env.local and set it to a PostgreSQL connection string.",
    );
  }

  return databaseUrl;
}
