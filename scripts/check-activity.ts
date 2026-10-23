import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{
      pid: number;
      state: string | null;
      wait_event_type: string | null;
      dur_sec: number | null;
      query: string;
    }>
  >`SELECT pid, state, wait_event_type,
      EXTRACT(EPOCH FROM (now() - query_start))::int AS dur_sec,
      LEFT(query, 120) AS query
    FROM pg_stat_activity
    WHERE datname = 'campus_pulse'
    ORDER BY query_start`;
  console.log(JSON.stringify(rows, null, 1));
}

main()
  .catch((e) => {
    console.error("ERROR:", e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
