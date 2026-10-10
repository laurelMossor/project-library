/**
 * Unit tests for the shared upload+attach client helper (src/lib/utils/image-client.ts).
 * The upload fetch is injected and the attach Server Action is mocked, so no network/globals
 * are needed. The critical invariant: the returned ImageItem's `id` comes from the *upload*
 * response (Image id) while `attachmentId` comes from the *attach* result (ImageAttachment id).
 */
import { describe, test, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/actions/image", () => ({ attachImageAction: vi.fn() }));

import { uploadAndAttachImage } from "@/lib/utils/image-client";
import { attachImageAction } from "@/lib/actions/image";

function ok(body: unknown): Response {
	return { ok: true, json: async () => body } as Response;
}
function fail(body: unknown): Response {
	return { ok: false, json: async () => body } as Response;
}
const file = () => new File(["x"], "y.jpg", { type: "image/jpeg" });

beforeEach(() => vi.clearAllMocks());

describe("uploadAndAttachImage", () => {
	test("uploads then attaches; maps image id and attachment id correctly", async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ id: "img-1", url: "http://x/y.jpg", path: "y.jpg" }));
		vi.mocked(attachImageAction).mockResolvedValue({ ok: true, data: "att-1" });

		const item = await uploadAndAttachImage({
			file: file(),
			folder: "post-photos",
			type: "POST",
			targetId: "post-1",
			sortOrder: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		// Upload goes to the folder-scoped endpoint with FormData.
		expect(fetchImpl.mock.calls[0][0]).toBe("/api/upload?folder=post-photos");
		expect(fetchImpl.mock.calls[0][1].method).toBe("POST");
		expect(fetchImpl.mock.calls[0][1].body).toBeInstanceOf(FormData);

		// Attach uses the uploaded image id.
		expect(attachImageAction).toHaveBeenCalledWith({
			imageId: "img-1",
			type: "POST",
			targetId: "post-1",
			replace: undefined,
			sortOrder: 0,
		});

		// Result maps ids from the right responses.
		expect(item.id).toBe("img-1");
		expect(item.attachmentId).toBe("att-1");
		expect(item.url).toBe("http://x/y.jpg");
		expect(item.caption).toBeNull();
	});

	test("throws on upload failure and never attaches", async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(fail({ error: "Upload failed" }));
		await expect(
			uploadAndAttachImage({ file: file(), folder: "post-photos", type: "POST", targetId: "post-1", fetchImpl: fetchImpl as unknown as typeof fetch })
		).rejects.toThrow("Upload failed");
		expect(attachImageAction).not.toHaveBeenCalled();
	});

	test("throws on attach failure with the action's message", async () => {
		const fetchImpl = vi.fn().mockResolvedValueOnce(ok({ id: "img-1", url: "u", path: "p" }));
		vi.mocked(attachImageAction).mockResolvedValue({ ok: false, error: "forbidden", message: "You can't add images here" });
		await expect(
			uploadAndAttachImage({ file: file(), folder: "post-photos", type: "POST", targetId: "post-1", fetchImpl: fetchImpl as unknown as typeof fetch })
		).rejects.toThrow("You can't add images here");
	});
});
