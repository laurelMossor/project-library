import { NextResponse } from "next/server";
import { ContentVisibility, AttachmentTarget } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { postHasContent } from "@/lib/utils/content";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { publicUserEmbedFields } from "@/lib/utils/server/user";
import { canEditContent, canModerateContent } from "@/lib/utils/server/permission";
import { PlacementError, resolveContentPlacement } from "@/lib/utils/server/content-placement";
import { deletePost } from "@/lib/utils/server/post";
import { getViewerContext, canViewPost, isContentOwner, requireViewablePost, resolveParentVisibility, syncDescendantVisibility } from "@/lib/utils/server/visibility";
import { MAX_PINNED_PER_PROFILE, PIN_CAP_MESSAGE } from "@/lib/const/pin";
import { canPinContent, otherPinnedCount } from "@/lib/utils/server/pin";

type Params = { params: Promise<{ id: string }> };

// Post content validation
function validatePostContent(content: string | undefined): { valid: boolean; error?: string } {
	if (content !== undefined) {
		if (typeof content !== "string") {
			return { valid: false, error: "Post content must be a string" };
		}
		if (content.trim().length === 0) {
			return { valid: false, error: "Post content cannot be empty" };
		}
		if (content.length > 10000) {
			return { valid: false, error: "Post content must be 10000 characters or less" };
		}
	}
	return { valid: true };
}

function validatePostTitle(title: string | undefined | null): { valid: boolean; error?: string } {
	if (title !== undefined && title !== null) {
		if (typeof title !== "string") {
			return { valid: false, error: "Post title must be a string" };
		}
		if (title.length > 200) {
			return { valid: false, error: "Post title must be 200 characters or less" };
		}
	}
	return { valid: true };
}

const postFields = {
	id: true,
	userId: true,
	pageId: true,
	asPageId: true,
	showOnAuthorProfile: true,
	eventId: true,
	parentPostId: true,
	title: true,
	content: true,
	status: true,
	contentVisibility: true,
	pinnedAt: true,
	tags: true,
	topics: true,
	createdAt: true,
	updatedAt: true,
	user: {
		select: publicUserEmbedFields,
	},
	page: {
		select: {
			id: true,
			name: true,
			handle: true,
			avatarImageId: true,
			avatarImage: { select: { url: true } },
		},
	},
	event: {
		select: {
			id: true,
			title: true,
		},
	},
	parentPost: {
		select: {
			id: true,
			title: true,
		},
	},
};

/**
 * GET /api/posts/:id
 * Get a post by ID
 * Public endpoint
 */
export async function GET(request: Request, { params }: Params) {
	try {
		const { id } = await params;

		const post = await prisma.post.findUnique({
			where: { id },
			select: postFields,
		});

		if (!post) {
			return notFound("Post not found");
		}

		const viewer = await getViewerContext();

		// DRAFT posts are visible only to their owner (author or a manager of the hosting page);
		// everyone else — and anyone who can't pass the content gate — gets 404, never an oracle.
		if (post.status === "DRAFT" && !(await isContentOwner(viewer, post))) {
			return notFound("Post not found");
		}
		if (!(await canViewPost(post, viewer))) {
			return notFound("Post not found");
		}

		return NextResponse.json(post);
	} catch (error) {
		console.error("GET /api/posts/:id error:", error);
		return serverError("Failed to fetch post");
	}
}

/**
 * PATCH /api/posts/:id
 * Update a post (must be the post author)
 */
export async function PATCH(request: Request, { params }: Params) {
	try {
		const { id } = await params;
		const viewer = await getViewerContext();
		if (!viewer.userId) {
			return unauthorized();
		}

		// Gate viewability first (missing / not-viewable → 404, no existence oracle — finding #20),
		// then refine to edit permission: the author, or a manager of the post's page → else 403.
		const existing = await requireViewablePost(id, viewer);
		if (!existing) {
			return notFound("Post not found");
		}

		const data = await request.json();
		// Pinning on a page is a manage action, separate from editing the words.
		// A page manager may pin a member's post; the member may not.
		const pinOnly = data.pinnedAt !== undefined
			&& Object.keys(data).every((key) => key === "pinnedAt")
			&& (await canPinContent(viewer.userId, { userId: existing.userId, pageId: existing.pageId }));
		if (!pinOnly && !(await canEditContent(viewer.userId, existing))) {
			return NextResponse.json(
				{ error: "You can only edit your own posts" },
				{ status: 403 }
			);
		}
		const { title, content, tags, topics, pinnedAt, status, pageId, asPageId, showOnAuthorProfile } = data;

		const placementTouched = pageId !== undefined || asPageId !== undefined || showOnAuthorProfile !== undefined;
		let placement: { pageId: string | null; asPageId: string | null; showOnAuthorProfile: boolean } | null = null;
		if (placementTouched) {
			if (existing.parentPostId) {
				return badRequest("A reply inherits its page from its parent post and cannot be moved");
			}
			if (existing.eventId) {
				return badRequest("An event update stays on its event and cannot be moved");
			}
			if (existing.status !== "DRAFT") {
				return badRequest("A published post's placement can't change");
			}
			try {
				placement = await resolveContentPlacement(viewer.userId, {
					asPageId: asPageId !== undefined ? asPageId : existing.asPageId,
					pageId: pageId !== undefined ? pageId : existing.pageId,
					showOnAuthorProfile: showOnAuthorProfile !== undefined ? showOnAuthorProfile : existing.showOnAuthorProfile,
				});
			} catch (err) {
				if (err instanceof PlacementError) return badRequest(err.message);
				throw err;
			}
		}

		// Validate content if provided
		const contentValidation = validatePostContent(content);
		if (!contentValidation.valid) {
			return badRequest(contentValidation.error || "Invalid post content");
		}

		// Validate title if provided
		const titleValidation = validatePostTitle(title);
		if (!titleValidation.valid) {
			return badRequest(titleValidation.error || "Invalid post title");
		}

		// Process tags if provided
		let processedTags: string[] | undefined;
		if (tags !== undefined) {
			if (typeof tags === "string") {
				processedTags = tags
					.split(",")
					.map((tag: string) => tag.trim())
					.filter(Boolean);
			} else if (Array.isArray(tags)) {
				processedTags = tags
					.map((tag: unknown) => (typeof tag === "string" ? tag.trim() : String(tag).trim()))
					.filter(Boolean);
			}
		}

		// Handle pinnedAt toggle — enforce 3-pin limit per user/page scope
		const pinPageId = placement?.pageId ?? existing.pageId;
		if (pinnedAt !== undefined) {
			if (!(await canPinContent(viewer.userId, { userId: existing.userId, pageId: pinPageId }))) {
				return badRequest(pinPageId
					? "Only page editors can pin posts on this page"
					: "You can only pin your own posts");
			}
			if (pinnedAt !== null) {
				const pinnedCount = await otherPinnedCount(
					pinPageId ? { pageId: pinPageId } : { userId: existing.userId },
					{ postId: id },
				);
				if (pinnedCount >= MAX_PINNED_PER_PROFILE) {
					return badRequest(PIN_CAP_MESSAGE);
				}
			}
		}

		const updateData: Record<string, unknown> = {};
		// Re-parenting (pageId change) re-derives the post's content visibility from its NEW parent —
		// passing the real eventId so an event-attached post inherits the event's visibility, not the
		// author's profile default (finding 3). Child update posts cascade to match.
		let reparentedVisibility: ContentVisibility | undefined;
		if (placement) {
			updateData.pageId = placement.pageId;
			updateData.asPageId = placement.asPageId;
			updateData.showOnAuthorProfile = placement.showOnAuthorProfile;
			if (placement.pageId !== existing.pageId) {
				reparentedVisibility = await resolveParentVisibility(existing.userId, placement.pageId, existing.eventId);
				updateData.contentVisibility = reparentedVisibility;
			}
		}
		if (title !== undefined) updateData.title = title?.trim() || null;
		if (content !== undefined) updateData.content = content.trim();
		if (processedTags !== undefined) updateData.tags = processedTags;
		if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];
		if (pinnedAt !== undefined) updateData.pinnedAt = pinnedAt === null ? null : new Date(pinnedAt);
		if (status === "PUBLISHED" || status === "DRAFT") {
			if (status === "PUBLISHED") {
				// A post is publishable with a title, body, OR at least one photo.
				// Resolve final title/content (incoming if set now, else stored); only count
				// image attachments when there's no text, so the common case stays a single read.
				const stored = (title === undefined || content === undefined)
					? await prisma.post.findUnique({ where: { id }, select: { title: true, content: true } })
					: null;
				const finalTitle = title !== undefined ? title : stored?.title ?? null;
				const finalContent = content !== undefined ? content : stored?.content ?? "";
				if (!postHasContent({ title: finalTitle, content: finalContent })) {
					const imageCount = await prisma.imageAttachment.count({ where: { type: AttachmentTarget.POST, targetId: id } });
					if (imageCount === 0) {
						return badRequest("Cannot publish an empty post");
					}
				}
			}
			updateData.status = status;
		}

		const post = await prisma.$transaction(async (tx) => {
			const updated = await tx.post.update({
				where: { id },
				data: updateData,
				select: postFields,
			});
			if (placement) {
				// Replies copy the parent's placement even when the page stays put, so a
				// draft that switches from "as the page" to "to the page" does not leave
				// replies speaking as the page. Visibility changes only with the audience.
				await tx.post.updateMany({
					where: { parentPostId: id },
					data: {
						pageId: placement.pageId,
						asPageId: placement.asPageId,
						showOnAuthorProfile: placement.showOnAuthorProfile,
					},
				});
				if (reparentedVisibility !== undefined) {
					await syncDescendantVisibility("POST", id, reparentedVisibility, tx);
				}
			}
			return updated;
		});

		return NextResponse.json(post);
	} catch (error) {
		console.error("PATCH /api/posts/:id error:", error);
		return serverError("Failed to update post");
	}
}

/**
 * DELETE /api/posts/:id
 * Delete a post (must be the post author)
 */
export async function DELETE(request: Request, { params }: Params) {
	try {
		const { id } = await params;
		const viewer = await getViewerContext();
		if (!viewer.userId) {
			return unauthorized();
		}

		// Gate viewability first (404 for missing / not-viewable), then author-only delete (403).
		const existing = await requireViewablePost(id, viewer);
		if (!existing) {
			return notFound("Post not found");
		}

		if (!(await canModerateContent(viewer.userId, existing))) {
			return NextResponse.json(
				{ error: "You can only delete your own posts" },
				{ status: 403 }
			);
		}

		// Delegates to the util so attachment/image cleanup lives in one place.
		await deletePost(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/posts/:id error:", error);
		return serverError("Failed to delete post");
	}
}
