/**
 * Unit tests for canManageAttachmentTarget (finding #22) and the storage URL/path validators
 * (finding #23). Prisma + the permission layer are mocked.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { AttachmentTarget } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { event: { findUnique: vi.fn() }, post: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/utils/server/permission", () => ({ canActAsEntity: vi.fn() }));

import { canManageAttachmentTarget } from "@/lib/utils/server/image-attachment";
import { isAllowedImageUrl, isAllowedStoragePath } from "@/lib/utils/server/storage";
import { prisma } from "@/lib/utils/server/prisma";
import { canActAsEntity } from "@/lib/utils/server/permission";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(canActAsEntity).mockResolvedValue(false);
});

describe("canManageAttachmentTarget", () => {
  test("PAGE target → defers to canActAsEntity on the page", async () => {
    vi.mocked(canActAsEntity).mockResolvedValue(true);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.PAGE, "page-1")).toBe(true);
    expect(canActAsEntity).toHaveBeenCalledWith("u1", { page: { id: "page-1" } });
  });

  test("EVENT target on a page → checks the hosting page's managers", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ userId: "owner-1", pageId: "page-1" } as never);
    vi.mocked(canActAsEntity).mockResolvedValue(true);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.EVENT, "e1")).toBe(true);
    expect(canActAsEntity).toHaveBeenCalledWith("u1", { page: { id: "page-1" } });
  });

  test("POST target (standalone) → checks the author", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner-1", pageId: null } as never);
    await canManageAttachmentTarget("u1", AttachmentTarget.POST, "p1");
    expect(canActAsEntity).toHaveBeenCalledWith("u1", { user: { id: "owner-1" } });
  });

  test("missing target row → false", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue(null as never);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.EVENT, "gone")).toBe(false);
  });

  test("IMAGE / MESSAGE targets have no ownership path → false", async () => {
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.IMAGE, "i1")).toBe(false);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.MESSAGE, "m1")).toBe(false);
  });
});

describe("storage url / path validators", () => {
  const OLD_ENV = process.env.NEXT_PUBLIC_SUPABASE_URL;
  beforeEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = "https://demo.supabase.co"; });
  afterEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = OLD_ENV; });

  test("accepts the app's own bucket url", () => {
    expect(isAllowedImageUrl("https://demo.supabase.co/storage/v1/object/public/uploads/a/b.png")).toBe(true);
  });
  test("accepts the local dev /uploads/ path", () => {
    expect(isAllowedImageUrl("/uploads/x.png")).toBe(true);
  });
  test("rejects an arbitrary external host", () => {
    expect(isAllowedImageUrl("https://evil.example.com/uploads/x.png")).toBe(false);
    expect(isAllowedImageUrl("https://demo.supabase.co/storage/v1/object/public/other-bucket/x.png")).toBe(false);
  });
  test("path must stay within the bucket (no traversal / absolute)", () => {
    expect(isAllowedStoragePath("a/b/c.png")).toBe(true);
    expect(isAllowedStoragePath("../secrets.png")).toBe(false);
    expect(isAllowedStoragePath("/etc/passwd")).toBe(false);
    expect(isAllowedStoragePath("")).toBe(false);
  });
});
