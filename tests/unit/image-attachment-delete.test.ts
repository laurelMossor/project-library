/**
 * Unit tests for the reference-guarded delete helpers in image-attachment.ts.
 * An Image row is hard-deleted only when nothing else references it — no other
 * ImageAttachment, and no User/Page avatar. Prisma + storage removal are mocked.
 */
import { describe, test, expect, vi, beforeEach } from "vitest";
import { AttachmentTarget } from "@prisma/client";

vi.mock("@/lib/utils/server/prisma", () => ({
  prisma: {
    imageAttachment: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    image: { findMany: vi.fn(), deleteMany: vi.fn() },
    user: { findMany: vi.fn() },
    page: { findMany: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/storage", () => ({ removeStoragePaths: vi.fn() }));

import { collectOrphanedImages, deleteAttachment, deleteAllAttachmentsForTarget } from "@/lib/utils/server/image-attachment";
import { prisma } from "@/lib/utils/server/prisma";
import { removeStoragePaths } from "@/lib/utils/server/storage";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(removeStoragePaths).mockResolvedValue(undefined);
  vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.user.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.page.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.image.findMany).mockResolvedValue([] as never);
  vi.mocked(prisma.image.deleteMany).mockResolvedValue({ count: 0 } as never);
});

describe("collectOrphanedImages", () => {
  test("keeps an image that is still attached or used as an avatar", async () => {
    vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([{ imageId: "still-attached" }] as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ avatarImageId: "user-avatar" }] as never);
    vi.mocked(prisma.page.findMany).mockResolvedValue([{ avatarImageId: "page-avatar" }] as never);
    vi.mocked(prisma.image.findMany).mockResolvedValue([{ path: "uploads/orphan.jpg" }] as never);

    const paths = await collectOrphanedImages(["still-attached", "user-avatar", "page-avatar", "orphan"]);

    expect(paths).toEqual(["uploads/orphan.jpg"]);
    expect(prisma.image.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["orphan"] } } });
  });
});

describe("deleteAttachment", () => {
  test("orphaned image → deletes attachment, Image row, and returns its path to storage", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue({ imageId: "img-1" } as never);
    vi.mocked(prisma.image.findMany).mockResolvedValue([{ path: "uploads/y.jpg" }] as never);

    await deleteAttachment("a1");

    expect(prisma.imageAttachment.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(prisma.image.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["img-1"] } } });
    expect(removeStoragePaths).toHaveBeenCalledWith(["uploads/y.jpg"]);
  });

  test("image still attached elsewhere → detaches only", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue({ imageId: "img-1" } as never);
    vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([{ imageId: "img-1" }] as never);

    await deleteAttachment("a1");

    expect(prisma.imageAttachment.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(prisma.image.deleteMany).not.toHaveBeenCalled();
    expect(removeStoragePaths).toHaveBeenCalledWith([]);
  });

  test("image used as a User avatar → keeps the Image", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue({ imageId: "img-1" } as never);
    vi.mocked(prisma.user.findMany).mockResolvedValue([{ avatarImageId: "img-1" }] as never);

    await deleteAttachment("a1");

    expect(prisma.image.deleteMany).not.toHaveBeenCalled();
  });

  test("image used as a Page avatar → keeps the Image", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue({ imageId: "img-1" } as never);
    vi.mocked(prisma.page.findMany).mockResolvedValue([{ avatarImageId: "img-1" }] as never);

    await deleteAttachment("a1");

    expect(prisma.image.deleteMany).not.toHaveBeenCalled();
  });

  test("missing attachment → no-op", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(null as never);

    await deleteAttachment("gone");

    expect(prisma.imageAttachment.delete).not.toHaveBeenCalled();
    expect(prisma.image.deleteMany).not.toHaveBeenCalled();
  });
});

describe("deleteAllAttachmentsForTarget", () => {
  test("onlyUploadedBy scopes the query to the caller's own images", async () => {
    vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([] as never);

    await deleteAllAttachmentsForTarget(AttachmentTarget.EVENT, "e1", { onlyUploadedBy: "u1" });

    expect(prisma.imageAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { type: "EVENT", targetId: "e1", image: { uploadedByUserId: "u1" } },
      })
    );
    expect(prisma.imageAttachment.deleteMany).not.toHaveBeenCalled();
  });

  test("without onlyUploadedBy → cleans up every attached image on the target", async () => {
    vi.mocked(prisma.imageAttachment.findMany)
      .mockResolvedValueOnce([
        { id: "a1", imageId: "img-1" },
        { id: "a2", imageId: "img-2" },
      ] as never)
      .mockResolvedValueOnce([] as never);
    vi.mocked(prisma.image.findMany).mockResolvedValue([
      { path: "uploads/1.jpg" },
      { path: "uploads/2.jpg" },
    ] as never);

    await deleteAllAttachmentsForTarget(AttachmentTarget.POST, "p1");

    expect(prisma.imageAttachment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a1", "a2"] } } });
    expect(prisma.image.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["img-1", "img-2"] } } });
    expect(removeStoragePaths).toHaveBeenCalledWith(["uploads/1.jpg", "uploads/2.jpg"]);
  });

  test("keeps a shared image while deleting the orphaned one", async () => {
    vi.mocked(prisma.imageAttachment.findMany)
      .mockResolvedValueOnce([
        { id: "a1", imageId: "img-1" },
        { id: "a2", imageId: "img-2" },
      ] as never)
      .mockResolvedValueOnce([{ imageId: "img-2" }] as never);
    vi.mocked(prisma.image.findMany).mockResolvedValue([{ path: "uploads/1.jpg" }] as never);

    await deleteAllAttachmentsForTarget(AttachmentTarget.POST, "p1");

    expect(prisma.image.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["img-1"] } } });
  });
});
