/* eslint-disable no-console */
/**
 * Seed script — reads per-user and per-page JSON packets from prisma/seed-data/
 */
// CRITICAL: Load env files BEFORE importing Prisma client
import { config } from "dotenv";
import { existsSync, readdirSync, readFileSync } from "fs";
import { resolve, join } from "path";

const isDev = process.env.NODE_ENV !== "production";

// Load environment files in Next.js order (later overrides earlier)
const envPath = resolve(process.cwd(), ".env");
if (existsSync(envPath)) config({ path: envPath });

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
if (existsSync(envLocalPath)) config({ path: envLocalPath, override: true });

if (isDev && process.env.DATABASE_URL && !process.env.DATABASE_URL.includes("localhost")) {
  console.warn("⚠️  WARNING: DATABASE_URL doesn't point to localhost in dev mode");
}

import {
  PrismaClient,
  PermissionRole,
  ResourceType,
  AttachmentTarget,
} from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// ── Types ──────────────────────────────────────────────────────────

export type SeedProfileElement = {
  kind: "LINK" | "TEXT";
  value: string;
  label?: string;
  caption?: string;
  url?: string;
  sortOrder: number;
};

export type SeedPost = {
  title?: string;
  content: string;
  tags?: string[];
  status?: "DRAFT" | "PUBLISHED";
  imageFilenames?: string[];
  updates?: { title?: string; content: string }[];
};

export type SeedEvent = {
  title?: string;
  content: string;
  location: string;
  latitude?: number;
  longitude?: number;
  tags?: string[];
  status?: "DRAFT" | "PUBLISHED";
  imageFilenames?: string[];
} & (
  | { eventDate: string; eventStartTime: string; eventTimezone: string; eventDateTime?: never }
  | { eventDateTime: string; eventDate?: never; eventStartTime?: never; eventTimezone?: string }
);

export type SeedUserPacket = {
  email: string;
  handle: string;
  password: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  headline?: string;
  bio?: string;
  interests?: string[];
  location?: string;
  aboutContent?: string;
  avatarImage?: string;
  profileElements?: SeedProfileElement[];
  posts?: SeedPost[];
  events?: SeedEvent[];
};

export type SeedPagePacket = {
  name: string;
  handle: string;
  headline?: string;
  bio?: string;
  interests?: string[];
  location?: string;
  aboutContent?: string;
  avatarImage?: string;
  profileElements?: SeedProfileElement[];
  creatorHandle: string;
  editors?: string[];
  members?: "*" | string[];
  posts?: SeedPost[];
  events?: SeedEvent[];
};

export type SeedRelationships = {
  follows?: { follower: string; following: string }[];
  conversations?: {
    participants: string[];
    messages: {
      senderHandle: string;
      asPageHandle?: string;
      content: string;
    }[];
  }[];
  rsvps?: {
    eventOwnerHandle: string;
    eventIndex: number;
    name: string;
    email: string;
    status: "GOING" | "MAYBE" | "CANT_MAKE_IT";
  }[];
};

// ── Setup ──────────────────────────────────────────────────────────

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  const envFile = isDev ? ".env.development" : ".env.production";
  throw new Error(
    `DATABASE_URL is not set. Make sure ${envFile} exists and has DATABASE_URL set.`
  );
}

const prisma = new PrismaClient({
  adapter: new PrismaPg(new Pool({ connectionString, max: 5 })),
});

const DATA_DIR = join(process.cwd(), "prisma", "seed-data");

function getImageUrl(filename: string): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (isDev && !supabaseUrl) return `/static/examples/${filename}`;
  if (!supabaseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set for production seed.");
  }
  return `${supabaseUrl}/storage/v1/object/public/uploads/examples/${filename}`;
}

function loadJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf-8")) as T;
}

function loadPackets<T>(dir: string): T[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json") && !f.endsWith(".template.json"))
    .sort()
    .map((f) => loadJson<T>(join(dir, f)));
}

function resolvePassword(password: string): string {
  if (password.startsWith("$env:")) {
    const envVar = password.slice(5);
    const value = process.env[envVar];
    if (!value) {
      throw new Error(
        `Password references env var "${envVar}" but it is not set. ` +
          `Add ${envVar} to your .env.development or .env.local file.`
      );
    }
    return value;
  }
  return password;
}

// ── Timezone helpers ──────────────────────────────────────────────

const TZ_ALIASES: Record<string, string> = {
  PST: "America/Los_Angeles",
  PDT: "America/Los_Angeles",
  MST: "America/Denver",
  MDT: "America/Denver",
  CST: "America/Chicago",
  CDT: "America/Chicago",
  EST: "America/New_York",
  EDT: "America/New_York",
  HST: "Pacific/Honolulu",
  AKST: "America/Anchorage",
  AKDT: "America/Anchorage",
  UTC: "UTC",
};

function resolveTimezone(tz: string): string {
  return TZ_ALIASES[tz.toUpperCase()] ?? tz;
}

function parseTime12h(time: string): { hour: number; minute: number } {
  const match = time.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) throw new Error(`Invalid time format "${time}" — expected "H:MM AM/PM"`);
  let hour = parseInt(match[1], 10);
  const minute = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  return { hour, minute };
}

function getTimezoneOffsetMs(utcDate: Date, timezone: string): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    year: "numeric", month: "numeric", day: "numeric",
    hour: "numeric", minute: "numeric", second: "numeric",
    hour12: false,
  });
  const parts = formatter.formatToParts(utcDate);
  const get = (type: string) => {
    let v = parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);
    if (type === "hour" && v === 24) v = 0;
    return v;
  };
  const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return localAsUtc - utcDate.getTime();
}

function composeDatetime(date: string, time: string, tz: string): Date {
  const iana = resolveTimezone(tz);
  const { hour, minute } = parseTime12h(time);
  const [y, m, d] = date.split("-").map(Number);
  // Treat the user's input as UTC to get a reference point
  const asUtcMs = Date.UTC(y, m - 1, d, hour, minute);
  // Find the timezone's offset at that instant
  const offsetMs = getTimezoneOffsetMs(new Date(asUtcMs), iana);
  // Subtract the offset to get the true UTC instant
  return new Date(asUtcMs - offsetMs);
}

function resolveSeedEventDatetime(eventData: SeedEvent): { eventDateTime: Date; eventTimezone: string | null } {
  if (eventData.eventDate) {
    const iana = resolveTimezone(eventData.eventTimezone);
    return {
      eventDateTime: composeDatetime(eventData.eventDate, eventData.eventStartTime, eventData.eventTimezone),
      eventTimezone: iana,
    };
  }
  return {
    eventDateTime: new Date(eventData.eventDateTime!),
    eventTimezone: eventData.eventTimezone ? resolveTimezone(eventData.eventTimezone) : null,
  };
}

// ── Geocoding ─────────────────────────────────────────────────────

const geocodeCache = new Map<string, { lat: number; lng: number } | null>();
let lastGeocodeTime = 0;

async function geocodeLocation(location: string): Promise<{ lat: number; lng: number } | null> {
  const key = location.trim().toLowerCase();
  if (geocodeCache.has(key)) return geocodeCache.get(key)!;

  // Nominatim rate limit: max 1 request per second
  const now = Date.now();
  const wait = Math.max(0, 1100 - (now - lastGeocodeTime));
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastGeocodeTime = Date.now();

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(location)}&format=json&limit=1`,
      { headers: { "User-Agent": "ProjectLibrary/1.0 (seed script)" } }
    );
    if (!res.ok) { geocodeCache.set(key, null); return null; }
    const data = await res.json();
    if (data && data.length > 0) {
      const result = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      geocodeCache.set(key, result);
      return result;
    }
  } catch {
    // Geocoding is best-effort during seeding
  }
  geocodeCache.set(key, null);
  return null;
}

async function resolveEventCoords(eventData: SeedEvent): Promise<{ latitude: number | null; longitude: number | null }> {
  if (eventData.latitude != null && eventData.longitude != null) {
    return { latitude: eventData.latitude, longitude: eventData.longitude };
  }
  if (eventData.location) {
    const coords = await geocodeLocation(eventData.location);
    if (coords) {
      console.log(`  📍 Geocoded "${eventData.location.substring(0, 50)}" → ${coords.lat.toFixed(4)}, ${coords.lng.toFixed(4)}`);
      return { latitude: coords.lat, longitude: coords.lng };
    }
    console.warn(`  ⚠️  Could not geocode "${eventData.location.substring(0, 50)}"`);
  }
  return { latitude: null, longitude: null };
}

// ── Main ───────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding...");

  const userPackets = loadPackets<SeedUserPacket>(join(DATA_DIR, "users"));
  const pagePackets = loadPackets<SeedPagePacket>(join(DATA_DIR, "pages"));
  const relationshipsPath = join(DATA_DIR, "relationships.json");
  const relationships: SeedRelationships = existsSync(relationshipsPath)
    ? loadJson<SeedRelationships>(relationshipsPath)
    : {};

  // ── Clear tables (cascade-safe order) ──
  console.log("🧹 Clearing tables...");
  const tables = [
    "imageAttachment",
    "profileElement",
    "rsvp",
    "follow",
    "permission",
    "message",
    "conversationParticipant",
    "conversation",
    "post",
    "event",
    "image",
    "handle",
    "page",
    "user",
  ] as const;

  for (const table of tables) {
    try {
      await (
        prisma[table] as { deleteMany: () => Promise<unknown> }
      ).deleteMany();
    } catch (e: unknown) {
      if ((e as { code?: string }).code !== "P2021") throw e;
    }
  }

  // ── Create Users ──
  console.log("👤 Creating users...");
  const usersByHandle = new Map<string, { id: string }>();

  for (const packet of userPackets) {
    const handle = packet.handle.toLowerCase();
    const password = resolvePassword(packet.password);
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        email: packet.email.toLowerCase(),
        passwordHash,
        handle,
        firstName: packet.firstName,
        lastName: packet.lastName,
        displayName:
          packet.displayName ?? `${packet.firstName} ${packet.lastName}`,
        headline: packet.headline ?? null,
        bio: packet.bio ?? null,
        interests: packet.interests ?? [],
        location: packet.location ?? null,
        handleRecord: { create: { handle } },
      },
      select: { id: true },
    });

    usersByHandle.set(handle, user);
  }

  // ── Create Pages ──
  console.log("📄 Creating pages...");
  const pagesByHandle = new Map<
    string,
    { id: string; creatorUserId: string }
  >();

  for (const packet of pagePackets) {
    const handle = packet.handle.toLowerCase();
    const creator = usersByHandle.get(packet.creatorHandle.toLowerCase());
    if (!creator) {
      throw new Error(
        `Page "${handle}" references unknown creator "${packet.creatorHandle}"`
      );
    }

    const page = await prisma.page.create({
      data: {
        name: packet.name,
        handle,
        headline: packet.headline ?? null,
        bio: packet.bio ?? null,
        interests: packet.interests ?? [],
        location: packet.location ?? null,
        createdByUserId: creator.id,
        handleRecord: { create: { handle } },
      },
      select: { id: true },
    });

    pagesByHandle.set(handle, { id: page.id, creatorUserId: creator.id });

    // ADMIN for creator
    await prisma.permission.create({
      data: {
        userId: creator.id,
        resourceId: page.id,
        resourceType: ResourceType.PAGE,
        role: PermissionRole.ADMIN,
      },
    });

    // EDITOR permissions
    for (const editorHandle of packet.editors ?? []) {
      const editor = usersByHandle.get(editorHandle.toLowerCase());
      if (!editor) {
        throw new Error(
          `Page "${handle}" references unknown editor "${editorHandle}"`
        );
      }
      await prisma.permission.create({
        data: {
          userId: editor.id,
          resourceId: page.id,
          resourceType: ResourceType.PAGE,
          role: PermissionRole.EDITOR,
        },
      });
    }

    // MEMBER permissions
    const editorSet = new Set(
      (packet.editors ?? []).map((h) => h.toLowerCase())
    );
    if (packet.members === "*") {
      for (const [userHandle, user] of usersByHandle) {
        if (
          userHandle === packet.creatorHandle.toLowerCase() ||
          editorSet.has(userHandle)
        )
          continue;
        await prisma.permission.create({
          data: {
            userId: user.id,
            resourceId: page.id,
            resourceType: ResourceType.PAGE,
            role: PermissionRole.MEMBER,
          },
        });
      }
    } else if (Array.isArray(packet.members)) {
      for (const memberHandle of packet.members) {
        const member = usersByHandle.get(memberHandle.toLowerCase());
        if (!member) continue;
        await prisma.permission.create({
          data: {
            userId: member.id,
            resourceId: page.id,
            resourceType: ResourceType.PAGE,
            role: PermissionRole.MEMBER,
          },
        });
      }
    }
  }

  // ── Avatars ──
  console.log("🖼️ Creating avatars...");

  async function createImage(
    filename: string,
    uploaderId: string,
    altText?: string
  ) {
    return prisma.image.create({
      data: {
        url: getImageUrl(filename),
        path: filename,
        altText: altText ?? null,
        uploadedByUserId: uploaderId,
      },
      select: { id: true },
    });
  }

  for (const packet of userPackets) {
    if (!packet.avatarImage) continue;
    const user = usersByHandle.get(packet.handle.toLowerCase())!;
    const image = await createImage(packet.avatarImage, user.id);
    await prisma.user.update({
      where: { id: user.id },
      data: { avatarImageId: image.id },
    });
  }

  for (const packet of pagePackets) {
    if (!packet.avatarImage) continue;
    const page = pagesByHandle.get(packet.handle.toLowerCase())!;
    const image = await createImage(packet.avatarImage, page.creatorUserId);
    await prisma.page.update({
      where: { id: page.id },
      data: { avatarImageId: image.id },
    });
  }

  // ── User Content ──
  console.log("📝 Creating user content...");
  const createdEventsByOwner = new Map<string, { id: string }[]>();

  for (const packet of userPackets) {
    const handle = packet.handle.toLowerCase();
    const user = usersByHandle.get(handle)!;

    if (packet.aboutContent) {
      await prisma.user.update({
        where: { id: user.id },
        data: { aboutContent: packet.aboutContent },
      });
    }

    if (packet.profileElements?.length) {
      await prisma.profileElement.createMany({
        data: packet.profileElements.map((el) => ({
          userId: user.id,
          kind: el.kind,
          value: el.value,
          label: el.label ?? null,
          caption: el.caption ?? null,
          url: el.url ?? null,
          sortOrder: el.sortOrder,
        })),
      });
    }

    for (const postData of packet.posts ?? []) {
      const post = await prisma.post.create({
        data: {
          userId: user.id,
          title: postData.title ?? null,
          content: postData.content,
          tags: postData.tags ?? [],
          status: postData.status ?? "PUBLISHED",
        },
        select: { id: true },
      });

      for (let i = 0; i < (postData.imageFilenames ?? []).length; i++) {
        const img = await createImage(postData.imageFilenames![i], user.id);
        await prisma.imageAttachment.create({
          data: {
            imageId: img.id,
            type: AttachmentTarget.POST,
            targetId: post.id,
            sortOrder: i,
          },
        });
      }

      for (const update of postData.updates ?? []) {
        await prisma.post.create({
          data: {
            userId: user.id,
            parentPostId: post.id,
            title: update.title ?? null,
            content: update.content,
          },
        });
      }
    }

    const userEvents: { id: string }[] = [];
    for (const eventData of packet.events ?? []) {
      const coords = await resolveEventCoords(eventData);
      const { eventDateTime, eventTimezone } = resolveSeedEventDatetime(eventData);
      const event = await prisma.event.create({
        data: {
          userId: user.id,
          title: eventData.title ?? null,
          content: eventData.content,
          eventDateTime,
          eventTimezone,
          location: eventData.location,
          latitude: coords.latitude,
          longitude: coords.longitude,
          tags: eventData.tags ?? [],
          status: eventData.status ?? "PUBLISHED",
        },
        select: { id: true },
      });
      userEvents.push(event);

      for (let i = 0; i < (eventData.imageFilenames ?? []).length; i++) {
        const img = await createImage(eventData.imageFilenames![i], user.id);
        await prisma.imageAttachment.create({
          data: {
            imageId: img.id,
            type: AttachmentTarget.EVENT,
            targetId: event.id,
            sortOrder: i,
          },
        });
      }
    }
    createdEventsByOwner.set(handle, userEvents);
  }

  // ── Page Content ──
  console.log("📄 Creating page content...");

  for (const packet of pagePackets) {
    const handle = packet.handle.toLowerCase();
    const page = pagesByHandle.get(handle)!;

    if (packet.aboutContent) {
      await prisma.page.update({
        where: { id: page.id },
        data: { aboutContent: packet.aboutContent },
      });
    }

    if (packet.profileElements?.length) {
      await prisma.profileElement.createMany({
        data: packet.profileElements.map((el) => ({
          pageId: page.id,
          kind: el.kind,
          value: el.value,
          label: el.label ?? null,
          caption: el.caption ?? null,
          url: el.url ?? null,
          sortOrder: el.sortOrder,
        })),
      });
    }

    for (const postData of packet.posts ?? []) {
      const post = await prisma.post.create({
        data: {
          userId: page.creatorUserId,
          pageId: page.id,
          title: postData.title ?? null,
          content: postData.content,
          tags: postData.tags ?? [],
          status: postData.status ?? "PUBLISHED",
        },
        select: { id: true },
      });

      for (let i = 0; i < (postData.imageFilenames ?? []).length; i++) {
        const img = await createImage(
          postData.imageFilenames![i],
          page.creatorUserId
        );
        await prisma.imageAttachment.create({
          data: {
            imageId: img.id,
            type: AttachmentTarget.POST,
            targetId: post.id,
            sortOrder: i,
          },
        });
      }
    }

    const pageEvents: { id: string }[] = [];
    for (const eventData of packet.events ?? []) {
      const coords = await resolveEventCoords(eventData);
      const { eventDateTime, eventTimezone } = resolveSeedEventDatetime(eventData);
      const event = await prisma.event.create({
        data: {
          userId: page.creatorUserId,
          pageId: page.id,
          title: eventData.title ?? null,
          content: eventData.content,
          eventDateTime,
          eventTimezone,
          location: eventData.location,
          latitude: coords.latitude,
          longitude: coords.longitude,
          tags: eventData.tags ?? [],
          status: eventData.status ?? "PUBLISHED",
        },
        select: { id: true },
      });
      pageEvents.push(event);

      for (let i = 0; i < (eventData.imageFilenames ?? []).length; i++) {
        const img = await createImage(
          eventData.imageFilenames![i],
          page.creatorUserId
        );
        await prisma.imageAttachment.create({
          data: {
            imageId: img.id,
            type: AttachmentTarget.EVENT,
            targetId: event.id,
            sortOrder: i,
          },
        });
      }
    }
    createdEventsByOwner.set(handle, pageEvents);
  }

  // ── Relationships ──
  console.log("🔗 Creating relationships...");

  function resolveHandle(h: string): { userId?: string; pageId?: string } {
    const lower = h.toLowerCase();
    const user = usersByHandle.get(lower);
    if (user) return { userId: user.id };
    const page = pagesByHandle.get(lower);
    if (page) return { pageId: page.id };
    throw new Error(`Unknown handle in relationships: "${h}"`);
  }

  // Follows
  for (const follow of relationships.follows ?? []) {
    const follower = resolveHandle(follow.follower);
    const following = resolveHandle(follow.following);

    if (!follower.userId) {
      throw new Error(
        `Follow follower "${follow.follower}" must be a user, not a page`
      );
    }

    await prisma.follow.create({
      data: {
        followerId: follower.userId,
        followingUserId: following.userId ?? null,
        followingPageId: following.pageId ?? null,
      },
    });
  }

  // Conversations + Messages
  for (const convo of relationships.conversations ?? []) {
    const participantData = convo.participants.map(resolveHandle);

    const conversation = await prisma.conversation.create({
      data: {
        participants: {
          create: participantData.map((p) => ({
            userId: p.userId ?? null,
            pageId: p.pageId ?? null,
          })),
        },
      },
    });

    for (const msg of convo.messages) {
      const sender = usersByHandle.get(msg.senderHandle.toLowerCase());
      if (!sender) {
        throw new Error(`Unknown message sender: "${msg.senderHandle}"`);
      }

      let asPageId: string | null = null;
      if (msg.asPageHandle) {
        const page = pagesByHandle.get(msg.asPageHandle.toLowerCase());
        if (!page) {
          throw new Error(`Unknown asPageHandle: "${msg.asPageHandle}"`);
        }
        asPageId = page.id;
      }

      await prisma.message.create({
        data: {
          conversationId: conversation.id,
          senderId: sender.id,
          asPageId,
          content: msg.content,
        },
      });
    }
  }

  // RSVPs
  for (const rsvp of relationships.rsvps ?? []) {
    const ownerHandle = rsvp.eventOwnerHandle.toLowerCase();
    const events = createdEventsByOwner.get(ownerHandle);
    if (!events) {
      throw new Error(`No events found for owner "${rsvp.eventOwnerHandle}"`);
    }
    const event = events[rsvp.eventIndex];
    if (!event) {
      throw new Error(
        `Event index ${rsvp.eventIndex} out of range for "${rsvp.eventOwnerHandle}"`
      );
    }

    await prisma.rsvp.create({
      data: {
        eventId: event.id,
        name: rsvp.name,
        email: rsvp.email,
        status: rsvp.status,
      },
    });
  }

  console.log("✅ Seed complete.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    console.error("\n💡 Troubleshooting:");
    console.error(
      "   1. Make sure schema.prisma is current and you've run: npx prisma generate"
    );
    const envFile = isDev ? ".env.development" : ".env.production";
    console.error(
      `   2. Check that DATABASE_URL in ${envFile} points to your database`
    );
    if (isDev) {
      console.error(
        "   3. Verify the database exists: createdb projectlibrary_dev"
      );
    }
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
