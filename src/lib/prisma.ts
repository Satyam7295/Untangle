import { PrismaClient } from "@prisma/client";

import { getDatabaseUrl } from "./env";

declare global {
  var prisma: PrismaClient | undefined;
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({ datasourceUrl: getDatabaseUrl() });
}

export const prisma = globalThis.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalThis.prisma = prisma;
}
