import { prisma } from "./prisma";

export async function getAdminTenant() {
  const slug = process.env.ADMIN_TENANT_SLUG?.trim() || "default";
  return prisma.tenant.upsert({
    where: { slug },
    create: { slug, name: slug === "default" ? "Default organization" : slug },
    update: {},
  });
}
