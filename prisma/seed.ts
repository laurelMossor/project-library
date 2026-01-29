/* eslint-disable no-console */
/**
 * Seed script for v3 schema (Owner-centric model)
 * 
 * IMPORTANT: Before running this script:
 * 1. Make sure schema.prisma is current and you've run: npx prisma generate
 * 2. Ensure DATABASE_URL in .env.development (for dev) or .env.production (for prod) points to your database
 * 
 * This script loads environment files in the same order as Next.js:
 * 1. .env (base config - includes AUTH_SECRET)
 * 2. .env.development or .env.production (based on NODE_ENV)
 * 3. .env.local (local overrides, if exists)
 */
// CRITICAL: Load env files BEFORE importing Prisma client
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const isDev = process.env.NODE_ENV !== "production";

// Load environment files in Next.js order (later overrides earlier)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log("📁 Loaded .env (base config)");
}

const envSpecificPath = resolve(
  process.cwd(),
  isDev ? ".env.development" : ".env.production"
);
if (existsSync(envSpecificPath)) {
  config({ path: envSpecificPath, override: true });
  console.log(`📁 Loaded ${isDev ? ".env.development" : ".env.production"} (${isDev ? "local" : "remote"} database)`);
} else {
  console.warn(`⚠️  ${isDev ? ".env.development" : ".env.production"} not found`);
}

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
  console.log("📁 Loaded .env.local (local overrides)");
}

if (isDev && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.warn("⚠️  WARNING: DATABASE_URL doesn't point to localhost!");
  console.warn(`   Current DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.warn("   Make sure .env.development has DATABASE_URL set to local database");
}

import { PrismaClient, OwnerType, OrgRole, ArtifactType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
import bcrypt from "bcryptjs";

/**
 * Generate a cuid-like ID for database records
 */
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(12).toString("base64url").slice(0, 16);
  return `c${timestamp}${random}`.slice(0, 25);
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envFile = isDev ? ".env.development" : ".env.production";
  throw new Error(`DATABASE_URL is not set. Make sure ${envFile} exists and has DATABASE_URL set.`);
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(
    new Pool({
      connectionString,
      max: 5,
    })
  ),
});

/**
 * Construct Supabase public URLs for seed images.
 */
const getSupabasePublicUrl = (storagePath: string): string => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. " +
      "Please set it in .env or .env.local to generate correct image URLs for seed data. " +
      "Example: NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co"
    );
  }
  return `${supabaseUrl}/storage/v1/object/public/uploads/examples/${storagePath}`;
};

const DATA_DIR = path.join(process.cwd(), "prisma", "seed-data");
const USERS_PATH = path.join(DATA_DIR, "users.json");
const PROJECTS_PATH = path.join(DATA_DIR, "projects.json");
const EVENTS_PATH = path.join(DATA_DIR, "events.json");
const IMAGES_PATH = path.join(DATA_DIR, "images.json");

type SeedUserJson = {
  email: string;
  username: string;
  password: string;
  name: string;
  headline?: string;
  bio?: string;
  interests?: string[];
  location?: string;
};

type SeedProjectJson = {
  title: string;
  description: string;
  tags: string[];
  ownerId: number; // 1-based index into users.json
  createdAt?: string;
  hasEntries?: boolean;
  imageFilenames?: string[];
};

type SeedEventJson = {
  title: string;
  description: string;
  dateTime: string;
  location: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  ownerId: number; // 1-based index into users.json
  createdAt?: string;
};

type SeedImageJson = {
  filename: string;
  altText?: string;
};

function loadJson<T>(p: string): T {
  const raw = fs.readFileSync(p, "utf-8");
  return JSON.parse(raw) as T;
}

function splitName(full: string): { firstName?: string; middleName?: string; lastName?: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return {};
  if (parts.length === 1) return { firstName: parts[0] };
  if (parts.length === 2) return { firstName: parts[0], lastName: parts[1] };
  return {
    firstName: parts[0],
    middleName: parts.slice(1, -1).join(" "),
    lastName: parts[parts.length - 1],
  };
}

/**
 * Utility: old seed data uses ownerId as 1-based index into users array.
 */
function userIndexToKey(ownerId: number): number {
  if (!Number.isInteger(ownerId) || ownerId < 1) {
    throw new Error(`Invalid ownerId ${ownerId}. Expected 1-based integer.`);
  }
  return ownerId - 1;
}

// Store created entities for reference
type CreatedUser = {
  id: string;
  personalOwnerId: string;
};

async function main() {
  console.log("🌱 Seeding...");

  const usersJson = loadJson<SeedUserJson[]>(USERS_PATH);
  const projectsJson = loadJson<SeedProjectJson[]>(PROJECTS_PATH);
  const eventsJson = loadJson<SeedEventJson[]>(EVENTS_PATH);
  const imagesJson = loadJson<SeedImageJson[]>(IMAGES_PATH);

  // Clear tables (order matters due to FKs)
  console.log("🧹 Clearing tables...");
  const tablesToClear = [
    "imageAttachment",
    "follow",
    "orgMember",
    "message",
    "post",
    "event",
    "project",
    "image",
    "org",
    "owner",
    "user",
  ] as const;

  for (const table of tablesToClear) {
    try {
      await (prisma[table] as { deleteMany: () => Promise<unknown> }).deleteMany();
    } catch (e: unknown) {
      const error = e as { code?: string };
      if (error.code !== "P2021") throw e;
    }
  }

  // ---- Create Users + Personal Owners (atomically using raw SQL)
  console.log("👤 Creating users + personal owners...");
  const createdUsers: CreatedUser[] = [];

  for (const u of usersJson) {
    const { firstName, middleName, lastName } = splitName(u.name);
    const passwordHash = await bcrypt.hash(u.password, 10);
    const userId = generateId();
    const ownerId = generateId();
    const now = new Date();

    // Use raw SQL to insert both User and Owner atomically
    // This handles the circular reference (User.ownerId <-> Owner.userId)
    await prisma.$transaction(async (tx) => {
      // Insert Owner first (references userId)
      await tx.$executeRaw`
        INSERT INTO owners (id, "userId", "orgId", type, status, "createdAt")
        VALUES (${ownerId}, ${userId}, NULL, 'USER', 'ACTIVE', ${now})
      `;

      // Insert User (references ownerId)
      await tx.$executeRaw`
        INSERT INTO users (id, "ownerId", email, "passwordHash", username, "firstName", "middleName", "lastName", "displayName", headline, bio, interests, location, "isPublic", "avatarImageId", "createdAt", "updatedAt")
        VALUES (${userId}, ${ownerId}, ${u.email.toLowerCase()}, ${passwordHash}, ${u.username}, ${firstName ?? null}, ${middleName ?? null}, ${lastName ?? null}, NULL, ${u.headline ?? null}, ${u.bio ?? null}, ${u.interests ?? []}::text[], ${u.location ?? null}, true, NULL, ${now}, ${now})
      `;
    });

    createdUsers.push({
      id: userId,
      personalOwnerId: ownerId,
    });
  }

  // ---- Create Images (uploadedBy is now an Owner)
  console.log("🖼️ Creating images...");
  const imagesByFilename = new Map<string, { id: string }>();

  const defaultUploader = createdUsers[0];
  if (!defaultUploader) throw new Error("No users created; cannot seed images.");

  for (const img of imagesJson) {
    const storagePath = img.filename;
    const url = getSupabasePublicUrl(storagePath);

    const created = await prisma.image.create({
      data: {
        url,
        path: storagePath,
        altText: img.altText ?? null,
        uploadedById: defaultUploader.personalOwnerId, // Owner ID, not User ID
      },
      select: { id: true },
    });

    imagesByFilename.set(img.filename, created);
  }

  // ---- Set User avatars
  console.log("🧷 Setting user avatars...");
  const avatarPool = Array.from(imagesByFilename.values()).map((v) => v.id);
  for (let i = 0; i < createdUsers.length; i++) {
    const avatarId = avatarPool[i % avatarPool.length];
    await prisma.user.update({
      where: { id: createdUsers[i].id },
      data: { avatarImageId: avatarId },
    });
  }

  // ---- Create Orgs + Org Owners + Memberships
  console.log("🏢 Creating orgs + memberships...");
  const orgDefs = [
    {
      name: "Portland Makers Guild",
      slug: "portland-makers-guild",
      headline: "Hands-on learning, shared tools, good people.",
      bio: "A community org for woodworking, textiles, and skill shares.",
      location: "Portland, OR",
      ownerUserIdx: 1,
      adminUserIdxs: [4],
    },
    {
      name: "Berkeley Builders Collective",
      slug: "berkeley-builders-collective",
      headline: "Build. Make. Connect.",
      bio: "A small collective for software + craft crossover projects.",
      location: "Berkeley, CA",
      ownerUserIdx: 2,
      adminUserIdxs: [3, 5],
    },
  ] as const;

  type CreatedOrg = {
    id: string;
    slug: string;
    primaryOwnerId: string; // The org-based Owner for the primary owner user
  };
  const createdOrgs: CreatedOrg[] = [];

  for (let i = 0; i < orgDefs.length; i++) {
    const def = orgDefs[i];
    const primaryUserIdx = def.ownerUserIdx;
    const primaryUser = createdUsers[primaryUserIdx];
    if (!primaryUser) throw new Error(`Owner user index ${primaryUserIdx} out of range`);

    // Create the org first (with primary owner's personal owner as temporary owner)
    const org = await prisma.org.create({
      data: {
        name: def.name,
        slug: def.slug,
        headline: def.headline,
        bio: def.bio,
        interests: [],
        location: def.location,
        createdByUserId: primaryUser.id,
        ownerId: primaryUser.personalOwnerId, // Will update after creating org-based owner
        avatarImageId: avatarPool[(i + createdUsers.length) % avatarPool.length],
      },
    });

    // Create org-based Owner for the primary owner user ("wearing org hat")
    const orgBasedOwner = await prisma.owner.create({
      data: {
        userId: primaryUser.id,
        orgId: org.id,
        type: OwnerType.ORG,
      },
    });

    // Update org to point to the org-based owner
    await prisma.org.update({
      where: { id: org.id },
      data: { ownerId: orgBasedOwner.id },
    });

    // Create OrgMember for primary owner (links to org-based Owner)
    await prisma.orgMember.create({
      data: {
        orgId: org.id,
        ownerId: orgBasedOwner.id,
        role: OrgRole.OWNER,
      },
    });

    createdOrgs.push({
      id: org.id,
      slug: org.slug,
      primaryOwnerId: orgBasedOwner.id,
    });

    // Create admin memberships
    for (const adminIdx of def.adminUserIdxs) {
      const adminUser = createdUsers[adminIdx];
      if (!adminUser) continue;

      // Create org-based Owner for admin
      const adminOrgOwner = await prisma.owner.create({
        data: {
          userId: adminUser.id,
          orgId: org.id,
          type: OwnerType.ORG,
        },
      });

      await prisma.orgMember.create({
        data: {
          orgId: org.id,
          ownerId: adminOrgOwner.id,
          role: OrgRole.ADMIN,
        },
      });
    }

    // Add remaining users as MEMBER
    for (const u of createdUsers) {
      // Skip if already added as owner or admin
      const existingMembership = await prisma.orgMember.findFirst({
        where: {
          orgId: org.id,
          owner: { userId: u.id },
        },
      });
      if (existingMembership) continue;

      // Create org-based Owner for member
      const memberOrgOwner = await prisma.owner.create({
        data: {
          userId: u.id,
          orgId: org.id,
          type: OwnerType.ORG,
        },
      });

      await prisma.orgMember.create({
        data: {
          orgId: org.id,
          ownerId: memberOrgOwner.id,
          role: OrgRole.MEMBER,
        },
      });
    }
  }

  // ---- Create Follows (Owner follows Owner)
  console.log("🧲 Creating follows...");
  const personalOwnerIds = createdUsers.map((u) => u.personalOwnerId);
  const orgOwnerIds = createdOrgs.map((o) => o.primaryOwnerId);

  const followPairs: Array<{ followerOwnerId: string; followingOwnerId: string }> = [];

  // Users follow other users (ring pattern)
  for (let i = 0; i < personalOwnerIds.length; i++) {
    const follower = personalOwnerIds[i];
    const following = personalOwnerIds[(i + 1) % personalOwnerIds.length];
    if (follower !== following) {
      followPairs.push({ followerOwnerId: follower, followingOwnerId: following });
    }
  }

  // Users follow orgs
  for (let i = 0; i < personalOwnerIds.length; i++) {
    const follower = personalOwnerIds[i];
    const followingOrg = orgOwnerIds[i % orgOwnerIds.length];
    if (follower !== followingOrg) {
      followPairs.push({ followerOwnerId: follower, followingOwnerId: followingOrg });
    }
  }

  // Orgs follow each other
  if (orgOwnerIds.length >= 2) {
    followPairs.push({ followerOwnerId: orgOwnerIds[0], followingOwnerId: orgOwnerIds[1] });
    followPairs.push({ followerOwnerId: orgOwnerIds[1], followingOwnerId: orgOwnerIds[0] });
  }

  for (const f of followPairs) {
    if (f.followerOwnerId === f.followingOwnerId) continue;
    await prisma.follow.upsert({
      where: {
        followerOwnerId_followingOwnerId: {
          followerOwnerId: f.followerOwnerId,
          followingOwnerId: f.followingOwnerId,
        },
      },
      update: {},
      create: f,
    });
  }

  // ---- Create Projects
  console.log("🧰 Creating projects...");
  const createdProjects: { id: string; ownerId: string; title: string }[] = [];

  for (const p of projectsJson) {
    const userIdx = userIndexToKey(p.ownerId);
    const ownerUser = createdUsers[userIdx];
    if (!ownerUser) throw new Error(`Project ownerId ${p.ownerId} out of range.`);

    const created = await prisma.project.create({
      data: {
        ownerId: ownerUser.personalOwnerId,
        title: p.title,
        description: p.description,
        tags: p.tags ?? [],
      },
      select: { id: true, ownerId: true, title: true },
    });

    createdProjects.push(created);

    // Attach images
    const imageFilenames = p.imageFilenames ?? [];
    for (let i = 0; i < imageFilenames.length; i++) {
      const img = imagesByFilename.get(imageFilenames[i]);
      if (!img) continue;

      await prisma.imageAttachment.create({
        data: {
          imageId: img.id,
          type: ArtifactType.PROJECT,
          targetId: created.id,
          sortOrder: i,
        },
      });
    }

    // Create posts under project
    const count = p.hasEntries ? 3 : 1;
    for (let i = 0; i < count; i++) {
      await prisma.post.create({
        data: {
          ownerId: ownerUser.personalOwnerId,
          projectId: created.id,
          title: i === 0 ? "Project update" : `Update #${i + 1}`,
          content:
            i === 0
              ? `Progress log for "${p.title}". What I did today, what I learned, and what's next.`
              : `More notes for "${p.title}": experiments, tweaks, and next steps.`,
        },
      });
    }
  }

  // ---- Create Events
  console.log("📅 Creating events...");
  const createdEvents: { id: string; ownerId: string; title: string }[] = [];

  for (const e of eventsJson) {
    const userIdx = userIndexToKey(e.ownerId);
    const ownerUser = createdUsers[userIdx];
    if (!ownerUser) throw new Error(`Event ownerId ${e.ownerId} out of range.`);

    const created = await prisma.event.create({
      data: {
        ownerId: ownerUser.personalOwnerId,
        title: e.title,
        description: e.description,
        eventDateTime: new Date(e.dateTime), // Changed from dateTime
        location: e.location,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        tags: e.tags ?? [],
      },
      select: { id: true, ownerId: true, title: true },
    });

    createdEvents.push(created);

    // Event announcement post
    await prisma.post.create({
      data: {
        ownerId: ownerUser.personalOwnerId,
        eventId: created.id,
        title: "Event update",
        content: `Reminder + details for "${e.title}". What to bring, who it's for, and how to join.`,
      },
    });
  }

  // ---- Create Standalone Posts
  console.log("📝 Creating standalone posts...");
  for (const u of createdUsers) {
    await prisma.post.create({
      data: {
        ownerId: u.personalOwnerId,
        title: "What I'm working on",
        content: "A quick standalone post — ideas, inspiration, and what I'm building this week.",
      },
    });
  }

  // Org posts
  for (const org of createdOrgs) {
    await prisma.post.create({
      data: {
        ownerId: org.primaryOwnerId,
        title: "Org bulletin",
        content: "Announcements, calls for help, and what we're building together.",
      },
    });
  }

  // ---- Create Messages (between Owners)
  console.log("💬 Creating messages...");
  if (createdUsers.length >= 2) {
    await prisma.message.createMany({
      data: [
        {
          senderId: createdUsers[0].personalOwnerId,
          receiverId: createdUsers[1].personalOwnerId,
          content: "Hey! Saw your project — want to trade notes sometime this week?",
        },
        {
          senderId: createdUsers[1].personalOwnerId,
          receiverId: createdUsers[0].personalOwnerId,
          content: "Yeah totally. Also: your photos are rad. How did you approach the pattern?",
        },
      ],
    });
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    console.error("\n💡 Troubleshooting:");
    console.error("   1. Make sure schema.prisma is current and you've run: npx prisma generate");
    const envFile = isDev ? ".env.development" : ".env.production";
    console.error(`   2. Check that DATABASE_URL in ${envFile} points to your database`);
    if (isDev) {
      console.error("   3. Verify the database exists: createdb projectlibrary_dev");
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
