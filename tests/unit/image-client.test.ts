/**
 * Unit tests for the shared upload+attach client helper (src/lib/utils/image-client.ts).
 * fetch is injected so no network/globals are needed. The critical invariant: the
 * returned ImageItem's `id` comes from the *upload* response (Image id) while
 * `attachmentId` comes from the *attach* response (ImageAttachment id).
 */
import { describe, test, expect, vi } from "vitest";
import { uploadAndAttachImage } from "@/lib/utils/image-client";

function ok(body: unknown): Response {
	return { ok: true, json: async () => body } as Response;
}
function fail(body: unknown): Response {
	return { ok: false, json: async () => body } as Response;
}
const file = () => new File(["x"], "y.jpg", { type: "image/jpeg" });

describe("uploadAndAttachImage", () => {
	test("uploads then attaches; maps image id and attachment id correctly", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(ok({ id: "img-1", url: "http://x/y.jpg", path: "y.jpg" }))
			.mockResolvedValueOnce(ok({ id: "att-1", imageId: "img-1", type: "POST", targetId: "post-1", sortOrder: 0 }));

		const item = await uploadAndAttachImage({
			file: file(),
			folder: "post-photos",
			type: "POST",
			targetId: "post-1",
			sortOrder: 0,
			fetchImpl: fetchImpl as unknown as typeof fetch,
		});

		// First call: upload to the folder-scoped endpoint with FormData.
		expect(fetchImpl.mock.calls[0][0]).toBe("/api/upload?folder=post-photos");
		expect(fetchImpl.mock.calls[0][1].method).toBe("POST");
		expect(fetchImpl.mock.calls[0][1].body).toBeInstanceOf(FormData);

		// Second call: attach with the uploaded image id.
		expect(fetchImpl.mock.calls[1][0]).toBe("/api/image-attachments");
		expect(JSON.parse(fetchImpl.mock.calls[1][1].body)).toEqual({
			imageId: "img-1",
			type: "POST",
			targetId: "post-1",
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
		expect(fetchImpl).toHaveBeenCalledTimes(1);
	});

	test("throws on attach failure", async () => {
		const fetchImpl = vi
			.fn()
			.mockResolvedValueOnce(ok({ id: "img-1", url: "u", path: "p" }))
			.mockResolvedValueOnce(fail({ error: "Failed to attach" }));
		await expect(
			uploadAndAttachImage({ file: file(), folder: "post-photos", type: "POST", targetId: "post-1", fetchImpl: fetchImpl as unknown as typeof fetch })
		).rejects.toThrow("Failed to attach");
	});
});
