import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

// Create a PostgreSQL connection pool
const pool = new pg.Pool({
	connectionString: process.env.DATABASE_URL,
});

// Create the Prisma adapter using the pg pool
const adapter = new PrismaPg(pool);

// Prevent multiple Prisma instances in development (hot reload creates new connections)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient({ adapter });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;