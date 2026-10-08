import "./env";
import { test, expect } from "@playwright/test";
import bcrypt from "bcryptjs";
import { ContentVisibility, PermissionRole, PostStatus, ResourceType } from "@prisma/client";
import { prisma } from "../src/lib/utils/server/prisma";
import { createUser } from "../src/lib/utils/server/user";
import { grantPermission } from "../src/lib/utils/server/permission";
import { submitLogin } from "./helpers/auth";

/**
 * Real-database check of the co-admin handover, driven through DELETE /api/me/user.
 * Throwaway users, so the seeded alice/sam data the rest of the suite uses stays put.
 * Setup stays in Prisma; the delete itself goes through the running app so this
 * process never imports the page module (that pulls next-auth, which Node can't resolve).
 */
test("deleting a co-admin keeps the page, its post, and tombstones their DM", async ({ page }) => {
  const stamp = Date.now();
  const passwordHash = await bcrypt.hash("password123", 10);
  const owner = await createUser({
    email: `del-owner-${stamp}@example.com`,
    handle: `del-owner-${stamp}`,
    passwordHash,
    emailVerified: new Date(),
    setupCompletedAt: new Date(),
  });
  const coadmin = await createUser({
    email: `del-coadmin-${stamp}@example.com`,
    handle: `del-coadmin-${stamp}`,
    passwordHash,
    emailVerified: new Date(),
    setupCompletedAt: new Date(),
  });
  const handle = `kept-page-${stamp}`;
  const created = await prisma.page.create({
    data: {
      createdByUserId: owner.userId,
      name: `Kept Page ${stamp}`,
      handle,
      contentVisibility: ContentVisibility.LISTED,
      handleRecord: { create: { handle } },
    },
  });
  await grantPermission(owner.userId, created.id, ResourceType.PAGE, PermissionRole.ADMIN);
  await grantPermission(coadmin.userId, created.id, ResourceType.PAGE, PermissionRole.ADMIN);

  const post = await prisma.post.create({
    data: {
      userId: owner.userId,
      pageId: created.id,
      asPageId: created.id,
      content: "spoken as the page",
      status: PostStatus.PUBLISHED,
      contentVisibility: ContentVisibility.LISTED,
    },
  });
  const conversation = await prisma.conversation.create({ data: {} });
  await prisma.conversationParticipant.createMany({
    data: [
      { conversationId: conversation.id, userId: owner.userId },
      { conversationId: conversation.id, userId: coadmin.userId },
    ],
  });
  const message = await prisma.message.create({
    data: { conversationId: conversation.id, senderId: owner.userId, content: "see you" },
  });

  try {
    await page.goto("/login");
    await submitLogin(page, `del-owner-${stamp}@example.com`, "password123");
    await page.waitForURL((url) => !url.pathname.includes("/login"), { timeout: 10_000 });

    const res = await page.request.delete("/api/me/user", { data: { expectedPageIds: [] } });
    expect(res.ok(), await res.text()).toBeTruthy();

    const surviving = await prisma.page.findUnique({ where: { id: created.id } });
    expect(surviving?.createdByUserId).toBe(coadmin.userId);

    const survivingPost = await prisma.post.findUnique({ where: { id: post.id } });
    expect(survivingPost?.content).toBe("spoken as the page");
    expect(survivingPost?.userId).toBe(coadmin.userId);
    expect(survivingPost?.asPageId).toBe(created.id);

    const tombstone = await prisma.message.findUnique({ where: { id: message.id } });
    expect(tombstone?.content).toBe("");
    expect(tombstone?.deletedAs).toBe("USER");
    expect(tombstone?.senderId).toBeNull();
    expect(await prisma.user.findUnique({ where: { id: owner.userId } })).toBeNull();
  } finally {
    await prisma.user.deleteMany({ where: { id: { in: [owner.userId, coadmin.userId] } } });
  }
});
