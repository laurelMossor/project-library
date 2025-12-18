import { PrismaClient } from "@prisma/client";

// Prevent multiple Prisma instances in development (hot reload creates new connections)
const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;

