// Boots a local PostgreSQL for development/testing. Not part of the app.
// Usage: node scripts/start-db.mjs
import EmbeddedPostgres from "embedded-postgres";

const DATA_DIR = "C:\\Users\\Hp\\AppData\\Local\\Temp\\opencode\\pg-data";

const pg = new EmbeddedPostgres({
  databaseDir: DATA_DIR,
  user: "postgres",
  password: "postgres",
  port: 5433,
  persistent: true,
});

try {
  await pg.initialise();
} catch {
  // Already initialised on a previous run.
}

await pg.start();
try {
  await pg.createDatabase("campus_pulse");
} catch {
  // Database already exists.
}
console.log("PostgreSQL ready on port 5433, database campus_pulse");

// Keep the process alive; SIGINT/SIGTERM stop it cleanly.
process.on("SIGINT", async () => {
  await pg.stop();
  process.exit(0);
});
process.on("SIGTERM", async () => {
  await pg.stop();
  process.exit(0);
});
