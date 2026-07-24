/**
 * Unit tests for the reference-guarded delete helpers in image-attachment.ts.
 * The invariant under test: an Image row + its storage blob are hard-deleted ONLY when
 * nothing else references the image — no other ImageAttachment, and no User/Page avatar.
 * A still-referenced image is left intact (deleting it would cascade away another
 * attachment or null an avatar). Prisma + deleteImage are mocked — no DB/storage needed.
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
      count: vi.fn(),
    },
    image: { delete: vi.fn() },
    user: { count: vi.fn() },
    page: { count: vi.fn() },
  },
}));
vi.mock("@/lib/utils/server/storage", () => ({ deleteImage: vi.fn() }));

import { deleteAttachment, deleteAllAttachmentsForTarget } from "@/lib/utils/server/image-attachment";
import { prisma } from "@/lib/utils/server/prisma";
import { deleteImage } from "@/lib/utils/server/storage";

const att = (id: string, imageId: string, url: string) => ({ id, image: { id: imageId, url } });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(deleteImage).mockResolvedValue({ success: true, error: null });
  // Default: image is orphaned after detach (no remaining refs anywhere).
  vi.mocked(prisma.imageAttachment.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.user.count).mockResolvedValue(0 as never);
  vi.mocked(prisma.page.count).mockResolvedValue(0 as never);
});

describe("deleteAttachment", () => {
  test("orphaned image → deletes attachment, Image row, and storage blob", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(att("a1", "img-1", "http://x/y.jpg") as never);

    await deleteAttachment("a1");

    expect(prisma.imageAttachment.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(prisma.image.delete).toHaveBeenCalledWith({ where: { id: "img-1" } });
    expect(deleteImage).toHaveBeenCalledWith("http://x/y.jpg");
  });

  test("image still attached elsewhere → detaches only, keeps Image + blob", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(att("a1", "img-1", "http://x/y.jpg") as never);
    vi.mocked(prisma.imageAttachment.count).mockResolvedValue(1 as never); // another attachment remains

    await deleteAttachment("a1");

    expect(prisma.imageAttachment.delete).toHaveBeenCalledWith({ where: { id: "a1" } });
    expect(prisma.image.delete).not.toHaveBeenCalled();
    expect(deleteImage).not.toHaveBeenCalled();
  });

  test("image used as a User avatar → keeps Image + blob (no silent avatar loss)", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(att("a1", "img-1", "http://x/y.jpg") as never);
    vi.mocked(prisma.user.count).mockResolvedValue(1 as never);

    await deleteAttachment("a1");

    expect(prisma.image.delete).not.toHaveBeenCalled();
    expect(deleteImage).not.toHaveBeenCalled();
  });

  test("image used as a Page avatar → keeps Image + blob", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(att("a1", "img-1", "http://x/y.jpg") as never);
    vi.mocked(prisma.page.count).mockResolvedValue(1 as never);

    await deleteAttachment("a1");

    expect(prisma.image.delete).not.toHaveBeenCalled();
  });

  test("missing attachment → no-op", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(null as never);

    await deleteAttachment("gone");

    expect(prisma.imageAttachment.delete).not.toHaveBeenCalled();
    expect(prisma.image.delete).not.toHaveBeenCalled();
  });

  test("storage failure is swallowed (Image row still deleted)", async () => {
    vi.mocked(prisma.imageAttachment.findUnique).mockResolvedValue(att("a1", "img-1", "/uploads/local.jpg") as never);
    vi.mocked(deleteImage).mockResolvedValue({ success: false, error: "Invalid image URL" });
    const err = vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(deleteAttachment("a1")).resolves.toBeUndefined();
    expect(prisma.image.delete).toHaveBeenCalled();
    err.mockRestore();
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
    expect(prisma.imageAttachment.deleteMany).not.toHaveBeenCalled(); // nothing matched
  });

  test("without onlyUploadedBy → cleans up every attached image on the target", async () => {
    vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([
      att("a1", "img-1", "http://x/1.jpg"),
      att("a2", "img-2", "http://x/2.jpg"),
    ] as never);

    await deleteAllAttachmentsForTarget(AttachmentTarget.POST, "p1");

    expect(prisma.imageAttachment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { type: "POST", targetId: "p1" } })
    );
    expect(prisma.imageAttachment.deleteMany).toHaveBeenCalledWith({ where: { id: { in: ["a1", "a2"] } } });
    expect(prisma.image.delete).toHaveBeenCalledTimes(2);
    expect(deleteImage).toHaveBeenCalledTimes(2);
  });

  test("keeps a shared image while deleting the orphaned one", async () => {
    vi.mocked(prisma.imageAttachment.findMany).mockResolvedValue([
      att("a1", "img-1", "http://x/1.jpg"), // orphaned
      att("a2", "img-2", "http://x/2.jpg"), // still referenced
    ] as never);
    // img-1 → 0 remaining, img-2 → 1 remaining
    vi.mocked(prisma.imageAttachment.count)
      .mockResolvedValueOnce(0 as never)
      .mockResolvedValueOnce(1 as never);

    await deleteAllAttachmentsForTarget(AttachmentTarget.POST, "p1");

    expect(prisma.image.delete).toHaveBeenCalledTimes(1);
    expect(prisma.image.delete).toHaveBeenCalledWith({ where: { id: "img-1" } });
  });
});
