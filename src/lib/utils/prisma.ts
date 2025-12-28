import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

// Use pooled URL for runtime on Vercel (Supabase connection pooling)
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	throw new Error("DATABASE_URL is not set. Please check your environment variables.");
}

export const prisma =
	globalForPrisma.prisma ??
	new PrismaClient({
		adapter: new PrismaPg(
			new Pool({
				connectionString,
				// Helps avoid "too many connections" patterns in serverless
				max: 5,
			})
		),
	});

if (process.env.NODE_ENV !== "production") {
	globalForPrisma.prisma = prisma;
}
