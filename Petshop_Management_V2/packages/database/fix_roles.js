const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function run() {
  const result = await prisma.role.updateMany({
    where: { code: { not: "SUPER_ADMIN" } },
    data: { isSystem: false }
  });
  console.log(`Updated ${result.count} roles.`);
}

run().catch(console.error).finally(() => prisma.$disconnect());
