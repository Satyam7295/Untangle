import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    {
      slug: "delivery",
      name: "Delivery",
      description: "Development sample category for delivery-related issues.",
      subcategories: [
        { slug: "late-delivery", name: "Late delivery" },
        { slug: "missing-items", name: "Missing items" },
      ],
    },
    {
      slug: "account",
      name: "Account",
      description: "Development sample category for account-related issues.",
      subcategories: [{ slug: "login-help", name: "Login help" }],
    },
  ];

  for (const categoryData of categories) {
    const category = await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: {
        name: categoryData.name,
        description: categoryData.description,
        isActive: true,
      },
      create: {
        slug: categoryData.slug,
        name: categoryData.name,
        description: categoryData.description,
      },
    });

    for (const subcategoryData of categoryData.subcategories) {
      await prisma.subcategory.upsert({
        where: {
          categoryId_slug: {
            categoryId: category.id,
            slug: subcategoryData.slug,
          },
        },
        update: {
          name: subcategoryData.name,
          isActive: true,
        },
        create: {
          categoryId: category.id,
          slug: subcategoryData.slug,
          name: subcategoryData.name,
        },
      });
    }
  }

  for (const priority of [
    { slug: "low", name: "Low", severity: 1 },
    { slug: "normal", name: "Normal", severity: 2 },
    { slug: "high", name: "High", severity: 3 },
  ]) {
    await prisma.priorityLevel.upsert({
      where: { slug: priority.slug },
      update: { name: priority.name, severity: priority.severity, isActive: true },
      create: priority,
    });
  }

  for (const team of [
    { slug: "customer-support", name: "Customer Support" },
    { slug: "operations", name: "Operations" },
  ]) {
    await prisma.team.upsert({
      where: { slug: team.slug },
      update: { name: team.name, isActive: true },
      create: team,
    });
  }
}

main()
  .catch((error) => {
    console.error("Development seed failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
