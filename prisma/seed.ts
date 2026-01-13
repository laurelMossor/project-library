/* eslint-disable no-console */
/**
 * Seed script for v2 schema
 * 
 * IMPORTANT: Before running this script:
 * 1. Make sure schema.prisma is set to v2
 * 2. Run: npx prisma generate
 * 3. Ensure DATABASE_URL in .env.development (for dev) or .env.production (for prod) points to your database
 * 
 * This script loads environment files in the same order as Next.js:
 * 1. .env (base config - includes AUTH_SECRET)
 * 2. .env.development or .env.production (based on NODE_ENV)
 * 3. .env.local (local overrides, if exists)
 */
// CRITICAL: Load env files BEFORE importing Prisma client
// The Prisma client reads DATABASE_URL at import time, so we must set it first
import { config } from "dotenv";
import { existsSync } from "fs";
import { resolve } from "path";

const isDev = process.env.NODE_ENV !== "production";

// Load environment files in Next.js order (later overrides earlier)
// 1. Base .env (contains AUTH_SECRET and shared config)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) {
  config({ path: envPath });
  console.log("📁 Loaded .env (base config)");
}

// 2. Environment-specific file (.env.development or .env.production)
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

// 3. .env.local (local overrides, highest priority)
const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
  console.log("📁 Loaded .env.local (local overrides)");
}

// Warn if using production database in dev
if (isDev && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.warn("⚠️  WARNING: DATABASE_URL doesn't point to localhost!");
  console.warn(`   Current DATABASE_URL: ${process.env.DATABASE_URL}`);
  console.warn("   Make sure .env.development has DATABASE_URL set to local database");
}

import { PrismaClient, ActorType, OrgRole, AttachmentType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import bcrypt from "bcryptjs";

// Create a fresh Prisma client for seeding (ensures it uses the correct DATABASE_URL from env files)
// This avoids issues with the shared singleton client that might have been created with wrong env vars
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
 * Uses NEXT_PUBLIC_SUPABASE_URL from environment (same as the app).
 * 
 * Local vs Remote:
 * - Local dev: .env.local can omit NEXT_PUBLIC_SUPABASE_URL (uses placeholder)
 * - Production: .env has NEXT_PUBLIC_SUPABASE_URL pointing to your Supabase project
 * 
 * Bucket name: "uploads" (matches the app's storage configuration)
 * URL format: ${NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/uploads/examples/${path}
 */
const getSupabasePublicUrl = (storagePath: string): string => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!supabaseUrl) {
    // Don't use placeholder URLs - they cause issues in production
    // Instead, throw an error so the user knows to set the env var
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL is not set. " +
      "Please set it in .env or .env.local to generate correct image URLs for seed data. " +
      "Example: NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co"
    );
  }
  return `${supabaseUrl}/storage/v1/object/public/uploads/examples/${storagePath}`;
};

/**
 * Paths to your existing JSON files.
 * (These correspond to the uploaded files you showed.)
 */
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
  hasEntries?: boolean; // legacy; we use it to create descendant posts
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
  // 3+ parts: first, middle (everything in between), last
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

async function main() {
  console.log("🌱 Seeding...");

  // ---- Load JSON
  const usersJson = loadJson<SeedUserJson[]>(USERS_PATH);
  const projectsJson = loadJson<SeedProjectJson[]>(PROJECTS_PATH);
  const eventsJson = loadJson<SeedEventJson[]>(EVENTS_PATH);
  const imagesJson = loadJson<SeedImageJson[]>(IMAGES_PATH);

  // ---- Start clean (dev only)
  // Order matters due to FKs.
  // Use try-catch to handle cases where tables don't exist yet (fresh database)
  console.log("🧹 Clearing tables...");
  try {
    await prisma.imageAttachment.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e; // P2021 = table doesn't exist
  }
  try {
    await prisma.follow.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.orgRoleLabel.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.orgMember.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.message.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.post.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.event.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.project.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.org.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.user.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.image.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }
  try {
    await prisma.actor.deleteMany();
  } catch (e: any) {
    if (e.code !== 'P2021') throw e;
  }

  // ---- Create Users + Actors
  console.log("👤 Creating users + actors...");
  const users = [];
  const userActorsByIdx: string[] = [];

  for (const u of usersJson) {
    const actor = await prisma.actor.create({
      data: { type: ActorType.USER },
    });

    const { firstName, middleName, lastName } = splitName(u.name);
    const passwordHash = await bcrypt.hash(u.password, 10);

    const user = await prisma.user.create({
      data: {
        actorId: actor.id,
        email: u.email.toLowerCase(),
        username: u.username,
        passwordHash,
        firstName,
        middleName,
        lastName,
        headline: u.headline ?? null,
        bio: u.bio ?? null,
        interests: u.interests ?? [],
        location: u.location ?? null,
      },
    });

    users.push(user);
    userActorsByIdx.push(actor.id);
  }

  // ---- Create Images
  console.log("🖼️ Creating images...");
  const imagesByFilename = new Map<string, { id: string }>();

  // Pick an uploader (first user) for all seed images (simple + consistent)
  const defaultUploader = users[0];
  if (!defaultUploader) throw new Error("No users created; cannot seed images.");

  for (const img of imagesJson) {
    const storagePath = img.filename;
    const url = getSupabasePublicUrl(storagePath);

    const created = await prisma.image.create({
      data: {
        url,
        path: storagePath,
        altText: img.altText ?? null,
        uploadedById: defaultUploader.id,
      },
      select: { id: true },
    });

    imagesByFilename.set(img.filename, created);
  }

  // ---- Set some User avatars (optional, but nice for UI)
  console.log("🧷 Setting user avatars...");
  const avatarPool = Array.from(imagesByFilename.values()).map((v) => v.id);
  for (let i = 0; i < users.length; i++) {
    const avatarId = avatarPool[i % avatarPool.length];
    await prisma.user.update({
      where: { id: users[i].id },
      data: { avatarImageId: avatarId },
    });
  }

  // ---- Create Orgs + Org Actors
  console.log("🏢 Creating orgs + memberships...");
  const orgDefs = [
    {
      name: "Portland Makers Guild",
      slug: "portland-makers-guild",
      headline: "Hands-on learning, shared tools, good people.",
      bio: "A community org for woodworking, textiles, and skill shares.",
      location: "Portland, OR",
      // owner/admin from seed users: Alice + George for example
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

  const orgs: { id: string; actorId: string; slug: string }[] = [];

  for (let i = 0; i < orgDefs.length; i++) {
    const def = orgDefs[i];

    const actor = await prisma.actor.create({
      data: { type: ActorType.ORG },
    });

    const org = await prisma.org.create({
      data: {
        actorId: actor.id,
        name: def.name,
        slug: def.slug,
        headline: def.headline,
        bio: def.bio,
        interests: [],
        location: def.location,
        // org avatar
        avatarImageId: avatarPool[(i + users.length) % avatarPool.length],
      },
      select: { id: true, actorId: true, slug: true },
    });

    orgs.push(org);

    // Memberships
    const ownerUser = users[def.ownerUserIdx];
    if (ownerUser) {
      await prisma.orgMember.create({
        data: { orgId: org.id, userId: ownerUser.id, role: OrgRole.OWNER },
      });
    }

    for (const adminIdx of def.adminUserIdxs) {
      const adminUser = users[adminIdx];
      if (!adminUser) continue;
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: adminUser.id } },
        update: { role: OrgRole.ADMIN },
        create: { orgId: org.id, userId: adminUser.id, role: OrgRole.ADMIN },
      });
    }

    // Add everyone else as MEMBER for nicer demo browsing
    for (const u of users) {
      await prisma.orgMember.upsert({
        where: { orgId_userId: { orgId: org.id, userId: u.id } },
        update: {},
        create: { orgId: org.id, userId: u.id, role: OrgRole.MEMBER },
      });
    }

    // Optional: role label customization
    await prisma.orgRoleLabel.createMany({
      data: [
        { orgId: org.id, role: OrgRole.FOLLOWER, label: "Followers" },
        { orgId: org.id, role: OrgRole.MEMBER, label: "Members" },
      ],
      skipDuplicates: true,
    });
  }

  // ---- Create Follows (User↔User, User↔Org, Org↔Org)
  console.log("🧲 Creating follows...");
  const allActorIds = {
    users: userActorsByIdx,
    orgs: orgs.map((o) => o.actorId),
  };

  const followPairs: Array<{ followerId: string; followingId: string }> = [];

  // Users follow other users (simple ring)
  for (let i = 0; i < allActorIds.users.length; i++) {
    const follower = allActorIds.users[i];
    const following = allActorIds.users[(i + 1) % allActorIds.users.length];
    followPairs.push({ followerId: follower, followingId: following });
  }

  // Users follow orgs
  for (let i = 0; i < allActorIds.users.length; i++) {
    const follower = allActorIds.users[i];
    const followingOrg = allActorIds.orgs[i % allActorIds.orgs.length];
    followPairs.push({ followerId: follower, followingId: followingOrg });
  }

  // Orgs follow a couple users + org↔org
  if (allActorIds.orgs.length >= 2) {
    followPairs.push({ followerId: allActorIds.orgs[0], followingId: allActorIds.orgs[1] });
    followPairs.push({ followerId: allActorIds.orgs[1], followingId: allActorIds.orgs[0] });
  }
  if (allActorIds.users.length >= 2 && allActorIds.orgs.length >= 1) {
    followPairs.push({ followerId: allActorIds.orgs[0], followingId: allActorIds.users[2 % allActorIds.users.length] });
    followPairs.push({ followerId: allActorIds.orgs[0], followingId: allActorIds.users[4 % allActorIds.users.length] });
  }

  for (const f of followPairs) {
    // Skip self-follow and duplicates safely
    if (f.followerId === f.followingId) continue;
    await prisma.follow.upsert({
      where: { followerId_followingId: { followerId: f.followerId, followingId: f.followingId } },
      update: {},
      create: f,
    });
  }

  // ---- Create Projects
  console.log("🧰 Creating projects...");
  const createdProjects: { id: string; ownerActorId: string; title: string }[] = [];

  for (const p of projectsJson) {
    const ownerActorId = userActorsByIdx[userIndexToKey(p.ownerId)];
    if (!ownerActorId) throw new Error(`Project ownerId ${p.ownerId} out of range.`);

    const created = await prisma.project.create({
      data: {
        ownerActorId,
        title: p.title,
        description: p.description,
        tags: p.tags ?? [],
        // Note: createdAt cannot be set directly unless you remove @default(now()) behavior via raw SQL.
        // If you want exact createdAt seeding, do it with a SQL migration or a raw update after create.
      },
      select: { id: true, ownerActorId: true, title: true },
    });

    createdProjects.push(created);

    // Attach images (project gallery)
    const imageFilenames = p.imageFilenames ?? [];
    for (let i = 0; i < imageFilenames.length; i++) {
      const img = imagesByFilename.get(imageFilenames[i]);
      if (!img) continue;

      await prisma.imageAttachment.create({
        data: {
          imageId: img.id,
          type: AttachmentType.PROJECT,
          targetId: created.id,
          sortOrder: i,
        },
      });
    }

    // Descendant posts under project
    const count = p.hasEntries ? 3 : 1;
    for (let i = 0; i < count; i++) {
      await prisma.post.create({
        data: {
          ownerActorId,
          projectId: created.id,
          title: i === 0 ? "Project update" : `Update #${i + 1}`,
          content:
            i === 0
              ? `Progress log for "${p.title}". What I did today, what I learned, and what’s next.`
              : `More notes for "${p.title}": experiments, tweaks, and next steps.`,
        },
      });
    }
  }

  // ---- Create Events
  console.log("📅 Creating events...");
  const createdEvents: { id: string; ownerActorId: string; title: string }[] = [];

  for (const e of eventsJson) {
    const ownerActorId = userActorsByIdx[userIndexToKey(e.ownerId)];
    if (!ownerActorId) throw new Error(`Event ownerId ${e.ownerId} out of range.`);

    const created = await prisma.event.create({
      data: {
        ownerActorId,
        title: e.title,
        description: e.description,
        dateTime: new Date(e.dateTime),
        location: e.location,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        tags: e.tags ?? [],
      },
      select: { id: true, ownerActorId: true, title: true },
    });

    createdEvents.push(created);

    // Descendant post under event (announcement)
    await prisma.post.create({
      data: {
        ownerActorId,
        eventId: created.id,
        title: "Event update",
        content: `Reminder + details for "${e.title}". What to bring, who it’s for, and how to join.`,
      },
    });
  }

  // ---- Create Standalone Posts (feeds)
  console.log("📝 Creating standalone posts...");
  // One per user
  for (let i = 0; i < userActorsByIdx.length; i++) {
    await prisma.post.create({
      data: {
        ownerActorId: userActorsByIdx[i],
        title: "What I'm working on",
        content: "A quick standalone post — ideas, inspiration, and what I'm building this week.",
      },
    });
  }
  // One per org
  for (let i = 0; i < orgs.length; i++) {
    await prisma.post.create({
      data: {
        ownerActorId: orgs[i].actorId,
        title: "Org bulletin",
        content: "Announcements, calls for help, and what we’re building together.",
      },
    });
  }

  // ---- Create a few Messages (optional demo)
  console.log("💬 Creating messages...");
  if (users.length >= 2) {
    await prisma.message.createMany({
      data: [
        {
          senderId: users[0].id,
          receiverId: users[1].id,
          content: "Hey! Saw your project — want to trade notes sometime this week?",
        },
        {
          senderId: users[1].id,
          receiverId: users[0].id,
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
    console.error("   1. Make sure schema.prisma is v2 and you've run: npx prisma generate");
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
