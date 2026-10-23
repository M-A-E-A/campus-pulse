// Removes leftovers from interrupted test runs. Run: npx tsx scripts/cleanup-test-data.ts
import { PrismaClient } from "@prisma/client";

async function main() {
  const p = new PrismaClient();
  const events = await p.event.deleteMany({ where: { title: { startsWith: "Race test" } } });
  const users = await p.user.deleteMany({ where: { email: { contains: "@test.dev" } } });
  console.log(`events deleted: ${events.count}, users deleted: ${users.count}`);
  await p.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
