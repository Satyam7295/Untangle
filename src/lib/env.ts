export type ServerEnvironment = Record<string, string | undefined>;

export type AdminConfiguration = {
  id: string;
  password: string;
  sessionSecret: string;
  tenantId: string;
};

export function getDatabaseUrl(environment: ServerEnvironment = process.env): string {
  const databaseUrl = environment.DATABASE_URL?.trim();

  if (!databaseUrl) {
    throw new Error(
      "DATABASE_URL is not configured. Copy .env.example to .env.local and set it to a PostgreSQL connection string.",
    );
  }

  return databaseUrl;
}

export function getAdminConfiguration(
  environment: ServerEnvironment = process.env,
): AdminConfiguration {
  const id = environment.ADMIN_ID;
  const password = environment.ADMIN_PASSWORD;
  const sessionSecret = environment.SESSION_SECRET;
  const tenantId = environment.ADMIN_TENANT_ID;

  if (!id || !password || !sessionSecret || !tenantId) {
    throw new Error(
      "ADMIN_ID, ADMIN_PASSWORD, SESSION_SECRET, and ADMIN_TENANT_ID are required. Copy .env.example to .env.local and configure server-only admin credentials.",
    );
  }

  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  return { id, password, sessionSecret, tenantId };
}
