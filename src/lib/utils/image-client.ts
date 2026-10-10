import type { AttachmentType, ImageItem } from "@/lib/types/image";
import { API_UPLOAD } from "@/lib/const/routes";
import { attachImageAction } from "@/lib/actions/image";

/**
 * Client-side image upload + attachment helpers.
 *
 * These collapse the three near-identical upload flows (avatar, event cover,
 * post photos) that used to be duplicated inline in each component. Callers own
 * *what* the image becomes (a direct avatar FK vs. a polymorphic ImageAttachment)
 * — these helpers only own the shared upload/attach network dance.
 *
 * `fetchImpl` defaults to the global `fetch` (tests inject a stub). A failed
 * upload — including a 401 from an expired session — throws with the route's message.
 */

type UploadOnlyArgs = {
	file: File;
	folder: string; // "avatars" | "event-covers" | "post-photos"
	fetchImpl?: typeof fetch;
};

type UploadResult = { id: string; url: string; path: string };

/** Upload a file and create its Image row. Returns the raw upload response. */
export async function uploadImageOnly({ file, folder, fetchImpl = fetch }: UploadOnlyArgs): Promise<UploadResult> {
	const formData = new FormData();
	formData.append("file", file);
	const res = await fetchImpl(API_UPLOAD(folder), { method: "POST", body: formData });
	if (!res.ok) {
		const data = await res.json().catch(() => ({}));
		throw new Error(data.error || "Upload failed");
	}
	return res.json();
}

type UploadAndAttachArgs = UploadOnlyArgs & {
	type: AttachmentType;
	targetId: string;
	replace?: boolean;
	sortOrder?: number;
};

/**
 * Upload a file, then attach it to a target (post/event/page).
 * Returns an ImageItem carrying its `attachmentId` — ready to push into carousel state.
 *
 * NOTE: the upload response `id` is the *Image* id (caption updates go through `updateImageAction`),
 * and the attachment response `id` is the *ImageAttachment* id (`removeImageAttachmentAction`).
 * Keep these straight — crossing them breaks both.
 */
export async function uploadAndAttachImage({
	file,
	folder,
	type,
	targetId,
	replace,
	sortOrder,
	fetchImpl = fetch,
}: UploadAndAttachArgs): Promise<ImageItem> {
	const image = await uploadImageOnly({ file, folder, fetchImpl });

	// The attach action refreshes the page, so server-rendered image lists pick the photo up.
	const attached = await attachImageAction({ imageId: image.id, type, targetId, replace, sortOrder });
	if (!attached.ok) throw new Error(attached.message ?? "Failed to attach image");

	return {
		id: image.id,
		url: image.url,
		path: image.path,
		altText: null,
		caption: null,
		uploadedByUserId: "",
		createdAt: new Date(),
		attachmentId: attached.data,
	};
}
