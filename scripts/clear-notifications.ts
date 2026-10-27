/**
 * Remove the demo notifications staged by scripts/stage-notifications.ts.
 * Scoped to the seeded student so nothing real is touched.
 *
 * Usage: node --import tsx scripts/clear-notifications.ts
 */
import { prisma } from "../src/lib/prisma";

async function main() {
  const student = await prisma.user.findUnique({ where: { email: "student@campus.ma" } });
  if (!student) throw new Error("student@campus.ma missing");
  const res = await prisma.notification.deleteMany({ where: { userId: student.id } });
  console.log(`removed ${res.count} notification(s) for ${student.email}`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  process.exitCode = 1;
  await prisma.$disconnect();
});
