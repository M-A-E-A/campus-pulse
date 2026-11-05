// Prisma 6 config (replaces the removed `package.json#prisma` block, which
// the CLI now warns about). The seed command lives under `migrations.seed`;
// `npx prisma db seed` and `migrate dev` both read it from here.
//
// With a config file present the CLI stops auto-loading `.env` ("Prisma
// config detected, skipping environment variable loading"), so this file
// loads it itself: dotenv-compatible KEY=VALUE lines, # comments, quoted
// values. Real environment variables always win - CI injects secrets that
// way without committing a file. Zero dependencies on purpose (no dotenv).
import { readFileSync } from "node:fs";
import { defineConfig } from "prisma/config";

try {
  // Relative to the working directory: every documented entry point in this
  // repo (npm scripts, npx, CI) runs from the project root.
  const raw = readFileSync(".env", "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
    if (!m) continue; // blanks and # comments
    let value = m[2].trim();
    if (value.length > 1) {
      const q = value[0];
      if ((q === '"' || q === "'") && value.endsWith(q)) value = value.slice(1, -1);
    }
    if (!(m[1] in process.env)) process.env[m[1]] = value;
  }
} catch {
  // No .env file: environment-only setup (CI) or a fresh clone.
}

export default defineConfig({
  schema: "./prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
