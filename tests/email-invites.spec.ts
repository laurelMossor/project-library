import "./env";
import { test, expect } from "@playwright/test";
import { ContentVisibility, MembershipPolicy, PermissionRole, ResourceType } from "@prisma/client";
import { prisma } from "../src/lib/utils/server/prisma";
import { grantPermission } from "../src/lib/utils/server/permission";
import { createSignupInvite } from "../src/lib/utils/server/signup-invite";
import { CONNECTIONS_MEMBERSHIP, SIGNUP_WITH_INVITE } from "../src/lib/const/routes";
import { EMAIL_INVITE_DAILY_CAP } from "../src/lib/const/email-invites";
import { STORAGE_STATE, USERS } from "./helpers/auth";
import { switchToPage } from "./helpers/profile";

/**
 * Invite people to a page by email, end to end. A throwaway INVITE_ONLY page ("playwright-test-*",
 * removed by global teardown; deleting it cascades its email invites and access requests) with sam
 * as ADMIN. New accounts use the "tst" prefix so teardown removes them too.
 */
test.use({ storageState: STORAGE_STATE.sam });
test.describe.configure({ mode: "serial" });

const stamp = Date.now();
const pageName = `PW Invites ${stamp}`;
const handle = `playwright-test-invites-${stamp}`;
let pageId: string;

test.beforeAll(async () => {
  const sam = await prisma.user.findUniqueOrThrow({ where: { email: USERS.sam.email }, select: { id: true } });
  const created = await prisma.page.create({
    data: {
      createdByUserId: sam.id,
      name: pageName,
      handle,
      membershipPolicy: MembershipPolicy.INVITE_ONLY,
      contentVisibility: ContentVisibility.LISTED,
      handleRecord: { create: { handle } },
    },
  });
  pageId = created.id;
  await grantPermission(sam.id, pageId, ResourceType.PAGE, PermissionRole.ADMIN);
});

test.afterAll(async () => {
  await prisma.page.deleteMany({ where: { id: pageId } });
});

test("sam invites by email: an existing account and a new address, then the new person signs up", async ({ page, browser }) => {
  const newbie = `tst${stamp % 1e7}`;
  const newEmail = `${newbie}@example.com`;
  const note = "Come make things with us";

  await page.goto("/explore");
  await switchToPage(page, pageName, "admin");
  await page.goto(CONNECTIONS_MEMBERSHIP);

  // Invite → the member search opens with "Invite via email" already offered → modal.
  await page.getByRole("button", { name: "Invite", exact: true }).click();
  await page.getByRole("option", { name: "Invite via email" }).click();
  const modal = page.getByRole("dialog", { name: "Invite via email" });
  await modal.getByLabel("Email addresses").fill(`${USERS.alice.email}, ${newEmail}`);
  await modal.getByLabel(/Note/).fill(note);
  await expect(modal.getByText("2 emails")).toBeVisible();

  // The preview lists every address and the note before anything is sent.
  const preview = modal.getByLabel("Invite preview");
  await expect(preview).toContainText(USERS.alice.email);
  await expect(preview).toContainText(newEmail);
  await expect(preview).toContainText(note);
  await modal.getByRole("button", { name: "Confirm" }).click();

  await expect(page.getByText("Invites sent to 2 addresses.")).toBeVisible({ timeout: 10_000 });
  // Both show by address — alice's account is never revealed as a profile row.
  await expect(page.getByText(USERS.alice.email, { exact: true })).toBeVisible();
  await expect(page.getByText(newEmail, { exact: true })).toBeVisible();
  await expect(page.getByText("Alice Example")).toHaveCount(0);

  // Alice already had an account: the invite (with the note) is waiting on her Membership tab.
  const aliceCtx = await browser.newContext({ storageState: STORAGE_STATE.alice });
  try {
    const alice = await aliceCtx.newPage();
    await alice.goto(CONNECTIONS_MEMBERSHIP);
    await expect(alice.getByText(pageName)).toBeVisible({ timeout: 10_000 });
    await expect(alice.getByText(`“${note}”`)).toBeVisible();
  } finally {
    await aliceCtx.close();
  }

  // The new address signs up (a fresh token for the same email — claiming keys on the address).
  const { rawToken } = await createSignupInvite(newEmail);
  const signupCtx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  try {
    const signup = await signupCtx.newPage();
    await signup.goto(SIGNUP_WITH_INVITE(rawToken));
    await signup.getByPlaceholder("Email").fill(newEmail);
    await signup.getByLabel("Handle").fill(newbie);
    await expect(signup.getByText("Available")).toBeVisible();
    await signup.getByPlaceholder("Password", { exact: true }).fill("password123");
    await signup.getByPlaceholder("Confirm password").fill("password123");
    await signup.getByRole("button", { name: "Sign Up" }).click();
    await signup.waitForURL(/\/verify-email\/check-inbox/, { timeout: 15_000 });
  } finally {
    await signupCtx.close();
  }

  // Their page invite was opened at signup, with the note, and they were notified.
  const user = await prisma.user.findUniqueOrThrow({ where: { email: newEmail }, select: { id: true } });
  const invite = await prisma.accessRequest.findFirst({
    where: { kind: "INVITE", requesterPageId: pageId, targetUserId: user.id },
  });
  expect(invite).toMatchObject({ role: "MEMBER", note });
  expect(
    await prisma.notification.count({ where: { recipientUserId: user.id, type: "MEMBER_INVITE" } }),
  ).toBe(1);
});

test("cancelling an email invite removes it from the list and leaves nothing to claim", async ({ page }) => {
  const email = `pw-cancel-${stamp}@example.com`;
  const res = await page.request.post(`/api/pages/${pageId}/email-invites`, {
    data: { emails: [email], role: "MEMBER" },
  });
  expect(res.status()).toBe(201);

  await page.goto("/explore");
  await switchToPage(page, pageName, "admin");
  await page.goto(CONNECTIONS_MEMBERSHIP);
  const row = page.getByText(email, { exact: true });
  await expect(row).toBeVisible({ timeout: 10_000 });

  // Same row-actions pattern as other pending invites: expand, then Cancel.
  const tag = page.locator("div.rounded-lg").filter({ has: row });
  await tag.getByRole("button", { name: "More actions" }).click();
  await tag.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(row).toHaveCount(0, { timeout: 10_000 });

  const waiting = await prisma.pageEmailInvite.count({ where: { pageId, email, cancelledAt: null } });
  expect(waiting).toBe(0);
});

test("guards: non-admins can't email-invite, CLOSED pages can't offer Member, the daily cap holds", async ({ page, browser }) => {
  // Non-admin.
  const aliceCtx = await browser.newContext({ storageState: STORAGE_STATE.alice });
  try {
    const res = await aliceCtx.request.post(`/api/pages/${pageId}/email-invites`, {
      data: { emails: ["someone@example.com"], role: "MEMBER" },
    });
    expect(res.status()).toBe(401);
  } finally {
    await aliceCtx.close();
  }

  // CLOSED page, MEMBER role.
  await prisma.page.update({ where: { id: pageId }, data: { membershipPolicy: MembershipPolicy.CLOSED } });
  try {
    const res = await page.request.post(`/api/pages/${pageId}/email-invites`, {
      data: { emails: ["someone@example.com"], role: "MEMBER" },
    });
    expect(res.status()).toBe(400);
  } finally {
    await prisma.page.update({ where: { id: pageId }, data: { membershipPolicy: MembershipPolicy.INVITE_ONLY } });
  }

  // Fill sam's last-24h count up to the cap (rows on this page, so teardown cascades them).
  const sam = await prisma.user.findUniqueOrThrow({ where: { email: USERS.sam.email }, select: { id: true } });
  const used = await prisma.pageEmailInvite.count({
    where: { invitedById: sam.id, createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } },
  });
  const fill = Math.max(0, EMAIL_INVITE_DAILY_CAP - used);
  await prisma.pageEmailInvite.createMany({
    data: Array.from({ length: fill }, (_, i) => ({
      pageId,
      invitedById: sam.id,
      email: `pw-cap-${stamp}-${i}@example.com`,
      role: PermissionRole.MEMBER,
      cancelledAt: new Date(),
    })),
  });

  const res = await page.request.post(`/api/pages/${pageId}/email-invites`, {
    data: { emails: [`pw-over-${stamp}@example.com`], role: "MEMBER" },
  });
  expect(res.status()).toBe(429);
  expect(await prisma.pageEmailInvite.count({ where: { email: `pw-over-${stamp}@example.com` } })).toBe(0);
});
