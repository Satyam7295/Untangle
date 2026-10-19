export type ServerEnvironment = Record<string, string | undefined>;

export type AdminCredentials = {
  id: string;
  password: string;
};

export type AdminConfiguration = {
  id: string;
  password: string;
  sessionSecret: string;
  tenantId: string;
};

export function getAdminCredentials(
  environment: ServerEnvironment = process.env,
): AdminCredentials {
  const id = environment.ADMIN_ID;
  const password = environment.ADMIN_PASSWORD;

  if (!id || !password) {
    throw new Error(
      "ADMIN_ID and ADMIN_PASSWORD are required. Copy .env.example to .env.local and configure server-only admin credentials.",
    );
  }

  return { id, password };
}

export function getSessionSecret(environment: ServerEnvironment = process.env): string {
  const sessionSecret = environment.SESSION_SECRET;

  if (!sessionSecret) {
    throw new Error(
      "SESSION_SECRET is required. Copy .env.example to .env.local and configure server-only admin credentials.",
    );
  }

  if (sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be at least 32 characters long.");
  }

  return sessionSecret;
}

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
  const tenantId = environment.ADMIN_TENANT_ID;

  if (!tenantId) {
    throw new Error(
      "ADMIN_TENANT_ID is required. Copy .env.example to .env.local and configure the tenant used for policy administration.",
    );
  }

  return { ...getAdminCredentials(environment), sessionSecret: getSessionSecret(environment), tenantId };
}
