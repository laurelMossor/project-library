/* eslint-disable no-console */
/**
 * Seed script for v0.4 schema (Permission-based, no Owner model)
 *
 * IMPORTANT: Before running this script:
 * 1. Make sure schema.prisma is current and you've run: npx prisma generate
 * 2. Ensure DATABASE_URL in .env.development (for dev) or .env.production (for prod) points to your database
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
}

const envSpecificPath = resolve(
  process.cwd(),
  isDev ? ".env.development" : ".env.production"
);
if (existsSync(envSpecificPath)) {
  config({ path: envSpecificPath, override: true });
} else {
  console.warn(`⚠️  ${isDev ? ".env.development" : ".env.production"} not found`);
}

const envLocalPath = resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  config({ path: envLocalPath, override: true });
}

if (isDev && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.warn("⚠️  WARNING: DATABASE_URL doesn't point to localhost in dev mode");
}

import { PrismaClient, PermissionRole, ResourceType, AttachmentTarget } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";
import bcrypt from "bcryptjs";

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
 * Construct URLs for seed images.
 * - Local dev: Uses local static files from /public/static/examples/
 * - Production: Uses Supabase storage URLs
 */
const getImageUrl = (filename: string): string => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (isDev && !supabaseUrl) {
    return `/static/examples/${filename}`;
  }

  if (!supabaseUrl) {
    throw new Error(
      `NEXT_PUBLIC_SUPABASE_URL is not set. ` +
      `Please set it in .env.production for seed data.`
    );
  }

  return `${supabaseUrl}/storage/v1/object/public/uploads/examples/${filename}`;
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
 * Utility: seed data uses ownerId as 1-based index into users array.
 */
function userIndexToKey(ownerId: number): number {
  if (!Number.isInteger(ownerId) || ownerId < 1) {
    throw new Error(`Invalid ownerId ${ownerId}. Expected 1-based integer.`);
  }
  return ownerId - 1;
}

type CreatedUser = {
  id: string;
};

async function main() {
  console.log("🌱 Seeding (v0.4 schema)...");

  const usersJson = loadJson<SeedUserJson[]>(USERS_PATH);
  const projectsJson = loadJson<SeedProjectJson[]>(PROJECTS_PATH);
  const eventsJson = loadJson<SeedEventJson[]>(EVENTS_PATH);
  const imagesJson = loadJson<SeedImageJson[]>(IMAGES_PATH);

  // Clear tables (order matters due to FKs)
  console.log("🧹 Clearing tables...");
  const tablesToClear = [
    "imageAttachment",
    "follow",
    "permission",
    "message",
    "conversationParticipant",
    "conversation",
    "post",
    "event",
    "image",
    "page",
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

  // ---- Create Users (no more Owner creation needed)
  console.log("👤 Creating users...");
  const createdUsers: CreatedUser[] = [];

  for (const u of usersJson) {
    const { firstName, middleName, lastName } = splitName(u.name);
    const passwordHash = await bcrypt.hash(u.password, 10);

    const user = await prisma.user.create({
      data: {
        email: u.email.toLowerCase(),
        passwordHash,
        username: u.username,
        firstName: firstName ?? null,
        middleName: middleName ?? null,
        lastName: lastName ?? null,
        headline: u.headline ?? null,
        bio: u.bio ?? null,
        interests: u.interests ?? [],
        location: u.location ?? null,
      },
      select: { id: true },
    });

    createdUsers.push({ id: user.id });
  }

  // ---- Create Images (uploadedBy is now a User)
  console.log("🖼️ Creating images...");
  const imagesByFilename = new Map<string, { id: string }>();

  const defaultUploader = createdUsers[0];
  if (!defaultUploader) throw new Error("No users created; cannot seed images.");

  for (const img of imagesJson) {
    const storagePath = img.filename;
    const url = getImageUrl(storagePath);

    const created = await prisma.image.create({
      data: {
        url,
        path: storagePath,
        altText: img.altText ?? null,
        uploadedByUserId: defaultUploader.id,
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

  // ---- Create Pages (replaces Orgs) + Permissions (replaces OrgMember)
  console.log("📄 Creating pages + permissions...");
  const pageDefs = [
    {
      name: "Portland Makers Guild",
      slug: "portland-makers-guild",
      headline: "Hands-on learning, shared tools, good people.",
      bio: "A community page for woodworking, textiles, and skill shares.",
      location: "Portland, OR",
      creatorUserIdx: 1,
      editorUserIdxs: [4],
    },
    {
      name: "Berkeley Builders Collective",
      slug: "berkeley-builders-collective",
      headline: "Build. Make. Connect.",
      bio: "A small collective for software + craft crossover projects.",
      location: "Berkeley, CA",
      creatorUserIdx: 2,
      editorUserIdxs: [3, 5],
    },
  ] as const;

  type CreatedPage = {
    id: string;
    slug: string;
    creatorUserId: string;
  };
  const createdPages: CreatedPage[] = [];

  for (let i = 0; i < pageDefs.length; i++) {
    const def = pageDefs[i];
    const creatorUser = createdUsers[def.creatorUserIdx];
    if (!creatorUser) throw new Error(`Creator user index ${def.creatorUserIdx} out of range`);

    const page = await prisma.page.create({
      data: {
        name: def.name,
        slug: def.slug,
        headline: def.headline,
        bio: def.bio,
        interests: [],
        location: def.location,
        createdByUserId: creatorUser.id,
        avatarImageId: avatarPool[(i + createdUsers.length) % avatarPool.length],
      },
    });

    // ADMIN permission for creator
    await prisma.permission.create({
      data: {
        userId: creatorUser.id,
        resourceId: page.id,
        resourceType: ResourceType.PAGE,
        role: PermissionRole.ADMIN,
      },
    });

    createdPages.push({
      id: page.id,
      slug: page.slug,
      creatorUserId: creatorUser.id,
    });

    // EDITOR permissions
    for (const editorIdx of def.editorUserIdxs) {
      const editorUser = createdUsers[editorIdx];
      if (!editorUser) continue;

      await prisma.permission.create({
        data: {
          userId: editorUser.id,
          resourceId: page.id,
          resourceType: ResourceType.PAGE,
          role: PermissionRole.EDITOR,
        },
      });
    }

    // MEMBER permissions for remaining users
    for (const u of createdUsers) {
      // Skip if already has a permission
      const existing = await prisma.permission.findUnique({
        where: {
          userId_resourceId_resourceType: {
            userId: u.id,
            resourceId: page.id,
            resourceType: ResourceType.PAGE,
          },
        },
      });
      if (existing) continue;

      await prisma.permission.create({
        data: {
          userId: u.id,
          resourceId: page.id,
          resourceType: ResourceType.PAGE,
          role: PermissionRole.MEMBER,
        },
      });
    }
  }

  // ---- Create Follows (User follows User or Page)
  console.log("🧲 Creating follows...");
  const userIds = createdUsers.map((u) => u.id);

  // Users follow other users (ring pattern)
  for (let i = 0; i < userIds.length; i++) {
    const followerId = userIds[i];
    const followingUserId = userIds[(i + 1) % userIds.length];
    if (followerId !== followingUserId) {
      await prisma.follow.upsert({
        where: {
          followerId_followingUserId: { followerId, followingUserId },
        },
        update: {},
        create: { followerId, followingUserId },
      });
    }
  }

  // Users follow pages
  for (let i = 0; i < userIds.length; i++) {
    const followerId = userIds[i];
    const followingPageId = createdPages[i % createdPages.length].id;

    await prisma.follow.upsert({
      where: {
        followerId_followingPageId: { followerId, followingPageId },
      },
      update: {},
      create: { followerId, followingPageId },
    });
  }

  // ---- Create Events
  console.log("📅 Creating events...");
  const createdEvents: { id: string; userId: string; title: string }[] = [];

  for (const e of eventsJson) {
    const userIdx = userIndexToKey(e.ownerId);
    const user = createdUsers[userIdx];
    if (!user) throw new Error(`Event ownerId ${e.ownerId} out of range.`);

    const created = await prisma.event.create({
      data: {
        userId: user.id,
        title: e.title,
        description: e.description,
        eventDateTime: new Date(e.dateTime),
        location: e.location,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
        tags: e.tags ?? [],
        status: "PUBLISHED",
      },
      select: { id: true, userId: true, title: true },
    });

    createdEvents.push(created);

    // Event announcement post
    await prisma.post.create({
      data: {
        userId: user.id,
        eventId: created.id,
        title: "Event update",
        content: `Reminder + details for "${e.title}". What to bring, who it's for, and how to join.`,
      },
    });
  }

  // ---- Create Posts (from projects.json — projects become posts in v0.4)
  console.log("📝 Creating posts (from projects seed data)...");
  const createdPosts: { id: string; userId: string; title: string | null }[] = [];

  for (const p of projectsJson) {
    const userIdx = userIndexToKey(p.ownerId);
    const user = createdUsers[userIdx];
    if (!user) throw new Error(`Project ownerId ${p.ownerId} out of range.`);

    const created = await prisma.post.create({
      data: {
        userId: user.id,
        title: p.title,
        content: p.description,
        tags: p.tags ?? [],
      },
      select: { id: true, userId: true, title: true },
    });

    createdPosts.push(created);

    // Attach images
    const imageFilenames = p.imageFilenames ?? [];
    for (let i = 0; i < imageFilenames.length; i++) {
      const img = imagesByFilename.get(imageFilenames[i]);
      if (!img) continue;

      await prisma.imageAttachment.create({
        data: {
          imageId: img.id,
          type: AttachmentTarget.POST,
          targetId: created.id,
          sortOrder: i,
        },
      });
    }

    // Create child update posts under this post
    const count = p.hasEntries ? 3 : 1;
    for (let i = 0; i < count; i++) {
      await prisma.post.create({
        data: {
          userId: user.id,
          parentPostId: created.id,
          title: i === 0 ? "Project update" : `Update #${i + 1}`,
          content:
            i === 0
              ? `Progress log for "${p.title}". What I did today, what I learned, and what's next.`
              : `More notes for "${p.title}": experiments, tweaks, and next steps.`,
        },
      });
    }
  }

  // Page posts (user posts "as" the page)
  for (const page of createdPages) {
    await prisma.post.create({
      data: {
        userId: page.creatorUserId,
        pageId: page.id,
        title: "Page bulletin",
        content: "Announcements, calls for help, and what we're building together.",
      },
    });
  }

  // ---- Create Conversations + Messages
  console.log("💬 Creating conversations + messages...");
  if (createdUsers.length >= 2) {
    // User-to-user DM
    const dmConvo = await prisma.conversation.create({
      data: {
        participants: {
          create: [
            { userId: createdUsers[0].id },
            { userId: createdUsers[1].id },
          ],
        },
      },
    });

    await prisma.message.create({
      data: {
        conversationId: dmConvo.id,
        senderId: createdUsers[0].id,
        content: "Hey! Saw your work — want to trade notes sometime this week?",
      },
    });

    await prisma.message.create({
      data: {
        conversationId: dmConvo.id,
        senderId: createdUsers[1].id,
        content: "Yeah totally. Also: your photos are rad. How did you approach the pattern?",
      },
    });

    // User messages a Page
    if (createdPages.length > 0) {
      const pageConvo = await prisma.conversation.create({
        data: {
          participants: {
            create: [
              { userId: createdUsers[2]?.id ?? createdUsers[0].id },
              { pageId: createdPages[0].id },
            ],
          },
        },
      });

      await prisma.message.create({
        data: {
          conversationId: pageConvo.id,
          senderId: createdUsers[2]?.id ?? createdUsers[0].id,
          content: "Hi! I'm interested in joining your next workshop. Any spots open?",
        },
      });

      // Page admin responds (as page)
      await prisma.message.create({
        data: {
          conversationId: pageConvo.id,
          senderId: createdPages[0].creatorUserId,
          asPageId: createdPages[0].id,
          content: "Welcome! We have a few spots open for next Saturday. Sign up at the door!",
        },
      });
    }
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
