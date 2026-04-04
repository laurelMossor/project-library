/**
 * Load env before Prisma-backed test helpers (same order as prisma/seed.ts).
 */
import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
	config({ path: envPath });
}
const devPath = resolve(root, ".env.development");
if (existsSync(devPath)) {
	config({ path: devPath, override: true });
}
// Optional — many setups only use .env + .env.development; skip if you have no .env.local
const localPath = resolve(root, ".env.local");
if (existsSync(localPath)) {
	config({ path: localPath, override: true });
}
