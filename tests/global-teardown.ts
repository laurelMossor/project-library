/**
 * Playwright global teardown — runs once after all tests complete.
 *
 * Cleans up test artifacts that have no delete UI:
 *   - Pages with handle matching "playwright-test-*"
 *   - Messages sent by automated tests ("Hello from Playwright…")
 *   - Users created by the signup test (handle matching "tst*")
 *
 * Events, posts, and follows are cleaned up by their own tests and do not
 * need handling here.
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

// Load env files in the same order as prisma.config.ts
function loadEnv() {
  const cwd = process.cwd();
  const files = [".env", ".env.development", ".env.local"];
  for (const file of files) {
    const p = resolve(cwd, file);
    if (existsSync(p)) config({ path: p, override: true });
  }
}

export default async function globalTeardown() {
  loadEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.warn("[teardown] DATABASE_URL not set — skipping cleanup");
    return;
  }

  const pool = new Pool({ connectionString, max: 2 });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  try {
    const [pages, messages, users] = await Promise.all([
      prisma.page.deleteMany({ where: { handle: { startsWith: "playwright-test-" } } }),
      prisma.message.deleteMany({ where: { content: { startsWith: "Hello from Playwright" } } }),
      prisma.user.deleteMany({ where: { handle: { startsWith: "tst" } } }),
    ]);

    console.log(
      `[teardown] cleaned up — pages: ${pages.count}, messages: ${messages.count}, users: ${users.count}`
    );
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}
