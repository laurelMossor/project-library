/**
 * Playwright global setup — runs once before all tests.
 *
 * Strips every application table, then reseeds from the packets. A previous
 * run can change alice or sam (password, handle, preferences); skipping the
 * seed when any user exists leaves login fixtures that no longer match.
 */

import { execSync } from "child_process";
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { Pool } from "pg";

const LOCAL_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

function loadEnv() {
  const cwd = process.cwd();
  const files = [".env", ".env.development", ".env.local"];
  for (const file of files) {
    const p = resolve(cwd, file);
    if (existsSync(p)) config({ path: p, override: true });
  }
}

function assertLocalDatabase(connectionString: string) {
  let host: string;
  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error("DATABASE_URL is not a valid URL.");
  }
  if (!LOCAL_HOSTS.has(host)) {
    throw new Error(
      `Refusing to strip a non-local database (host: ${host}). Playwright setup only resets localhost.`
    );
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
  assertLocalDatabase(connectionString);

  const pool = new Pool({ connectionString, max: 1 });
  try {
    console.log("[setup] Stripping database...");
    // A reused `npm run dev` holds connections that block TRUNCATE.
    await pool.query(`
      SELECT pg_terminate_backend(pid)
      FROM pg_stat_activity
      WHERE datname = current_database()
        AND pid <> pg_backend_pid()
        AND backend_type = 'client backend'
    `);
    await pool.query(`
      DO $$ DECLARE r RECORD;
      BEGIN
        FOR r IN (
          SELECT tablename
          FROM pg_tables
          WHERE schemaname = 'public'
            AND tablename <> '_prisma_migrations'
        ) LOOP
          EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' RESTART IDENTITY CASCADE';
        END LOOP;
      END $$;
    `);
  } finally {
    await pool.end();
  }

  console.log("[setup] Reseeding...");
  execSync("npm run db:seed:dev", { stdio: "inherit" });
}
