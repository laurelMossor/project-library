import { NextResponse } from "next/server";
import { ContentVisibility } from "@prisma/client";
import { prisma } from "@/lib/utils/server/prisma";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { publicUserEmbedFields } from "@/lib/utils/server/user";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { getViewerContext, canViewPost, isContentOwner, requireViewablePost, resolveParentVisibility, syncDescendantVisibility } from "@/lib/utils/server/visibility";

const MAX_PINNED_POSTS = 3;

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

		const isAuthor = existing.userId === viewer.userId;
		const isPageEditor = existing.pageId
			? await canPostAsPage(viewer.userId, existing.pageId)
			: false;

		if (!isAuthor && !isPageEditor) {
			return NextResponse.json(
				{ error: "You can only edit your own posts" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, content, tags, topics, pinnedAt, status, pageId } = data;

		// A reply inherits its page from its parent post (INV-3) — it cannot be re-pointed
		// to a different page directly; the parent's page is the single source of truth.
		if (pageId !== undefined && existing.parentPostId) {
			return badRequest("A reply inherits its page from its parent post and cannot be moved");
		}

		// If switching author page, verify permission for the new page
		if (pageId !== undefined) {
			if (pageId !== null) {
				const allowed = await canPostAsPage(viewer.userId, pageId);
				if (!allowed) {
					return badRequest("You don't have permission to post as this page");
				}
			} else if (existing.userId !== viewer.userId) {
				// Switching to personal identity — only the post author can do this
				return NextResponse.json({ error: "Only the post author can change the posting identity" }, { status: 403 });
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
		if (pinnedAt !== undefined) {
			if (pinnedAt !== null) {
				// Pinning: count existing pinned posts in the same scope
				const scopeWhere = existing.pageId
					? { pageId: existing.pageId, pinnedAt: { not: null } }
					: { userId: existing.userId, pageId: null, pinnedAt: { not: null } };
				const pinnedCount = await prisma.post.count({ where: scopeWhere });
				if (pinnedCount >= MAX_PINNED_POSTS) {
					return badRequest(`You can only pin up to ${MAX_PINNED_POSTS} posts at a time`);
				}
			}
		}

		const updateData: Record<string, unknown> = {};
		// Re-parenting (pageId change) re-derives the post's content visibility from its NEW parent —
		// passing the real eventId so an event-attached post inherits the event's visibility, not the
		// author's profile default (finding 3). Child update posts cascade to match.
		let reparentedVisibility: ContentVisibility | undefined;
		if (pageId !== undefined) {
			updateData.pageId = pageId;
			if ((pageId || null) !== existing.pageId) {
				reparentedVisibility = await resolveParentVisibility(existing.userId, pageId || null, existing.eventId);
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
				// Use incoming content if being set now, otherwise check the stored content.
				const publishContent = content !== undefined
					? content.trim()
					: (await prisma.post.findUnique({ where: { id }, select: { content: true } }))?.content ?? "";
				if (!publishContent || publishContent.trim().length === 0) {
					return badRequest("Cannot publish a post with empty content");
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
			if (reparentedVisibility !== undefined) {
				// Replies live in the parent's page context (INV-3) and inherit its visibility —
				// keep both in sync when the parent is re-parented.
				await tx.post.updateMany({
					where: { parentPostId: id },
					data: { pageId: pageId || null },
				});
				await syncDescendantVisibility("POST", id, reparentedVisibility, tx);
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

		if (existing.userId !== viewer.userId) {
			return NextResponse.json(
				{ error: "You can only delete your own posts" },
				{ status: 403 }
			);
		}

		await prisma.post.delete({ where: { id } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/posts/:id error:", error);
		return serverError("Failed to delete post");
	}
}
