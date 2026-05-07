/**
 * Playwright global setup — runs once before all tests.
 *
 * Checks whether the dev DB is seeded. If not (e.g. fresh checkout, DB was
 * reset), seeds it automatically so tests have the data they need.
 */

import { execSync } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

function loadEnv() {
  const cwd = process.cwd();
  const files = [".env", ".env.development", ".env.local"];
  for (const file of files) {
    const p = resolve(cwd, file);
    if (existsSync(p)) config({ path: p, override: true });
  }
}

export default async function globalSetup() {
  loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error(
      "DATABASE_URL not set. Make sure .env.development exists with DATABASE_URL set."
    );
  }

  const pool = new Pool({ connectionString, max: 2 });
  try {
    const { rows } = await pool.query("SELECT COUNT(*) FROM users");
    const count = parseInt(rows[0].count, 10);

    if (count > 0) {
      console.log(`[setup] DB already seeded (${count} users)`);
      return;
    }
  } catch {
    // Table may not exist on a brand-new DB — seed will create it
  } finally {
    await pool.end();
  }

  console.log("[setup] DB empty — seeding...");
  execSync("npm run db:seed:dev", { stdio: "inherit" });
}
