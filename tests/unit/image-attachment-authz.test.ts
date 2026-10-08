/**
 * Unit tests for canManageAttachmentTarget (finding #22) and the storage URL/path validators
 * (finding #23). Prisma + the permission layer are mocked.
 */
import { describe, test, expect, vi, beforeEach, afterEach } from "vitest";
import { AttachmentTarget } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: { event: { findUnique: vi.fn() }, post: { findUnique: vi.fn() } },
}));
vi.mock("@/lib/utils/server/permission", () => ({
  canActAsEntity: vi.fn(),
  canEditContent: vi.fn(),
}));

import { canManageAttachmentTarget } from "@/lib/utils/server/image-attachment";
import { isAllowedImageUrl, isAllowedStoragePath } from "@/lib/utils/server/storage";
import { prisma } from "@/lib/utils/server/prisma";
import { canActAsEntity, canEditContent } from "@/lib/utils/server/permission";

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

  test("EVENT target → the author or the page it is spoken as, not a to-page manager", async () => {
    vi.mocked(prisma.event.findUnique).mockResolvedValue({ userId: "owner-1", pageId: "page-1", asPageId: null } as never);
    vi.mocked(canEditContent).mockResolvedValue(false);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.EVENT, "e1")).toBe(false);
    expect(canEditContent).toHaveBeenCalledWith("u1", expect.objectContaining({ asPageId: null, pageId: "page-1" }));
  });

  test("POST target → defers to canEditContent", async () => {
    vi.mocked(prisma.post.findUnique).mockResolvedValue({ userId: "owner-1", pageId: null, asPageId: null } as never);
    vi.mocked(canEditContent).mockResolvedValue(true);
    expect(await canManageAttachmentTarget("u1", AttachmentTarget.POST, "p1")).toBe(true);
    expect(canEditContent).toHaveBeenCalled();
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
