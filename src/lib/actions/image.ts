"use server";

import { AttachmentTarget } from "@prisma/client";
import { authedAction, requireId } from "@/lib/utils/server/action";
import { attachOwnImage, removeAttachmentAs, updateOwnImage } from "@/lib/utils/server/image-attachment";

// Uploading the file itself stays an HTTP route (/api/upload): multipart bodies
// up to 5MB exceed the Server Action body limit. Everything after upload is here.

/** Attach an uploaded image to a page/event/post the caller manages. Returns the attachment id. */
export const attachImageAction = authedAction(
	async (ctx, input: { imageId: string; type: AttachmentTarget; targetId: string; sortOrder?: number; replace?: boolean }) =>
		attachOwnImage(ctx.userId, {
			imageId: requireId(input?.imageId, "image"),
			type: input.type,
			targetId: requireId(input.targetId, "target"),
			sortOrder: typeof input.sortOrder === "number" ? input.sortOrder : 0,
			replace: input.replace === true,
		}),
);

/** Remove a photo from wherever it's attached. */
export const removeImageAttachmentAction = authedAction(
	async (ctx, input: { attachmentId: string }) => {
		await removeAttachmentAs(ctx.userId, requireId(input?.attachmentId, "photo"));
	},
);

/** Update a photo's caption and/or alt text. */
export const updateImageAction = authedAction(
	async (ctx, input: { imageId: string; caption?: string | null; altText?: string | null }) => {
		await updateOwnImage(ctx.userId, requireId(input?.imageId, "image"), { caption: input.caption, altText: input.altText });
	},
);
