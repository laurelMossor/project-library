import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, badRequest, notFound, serverError } from "@/lib/utils/errors";
import { publicUserEmbedFields } from "@/lib/utils/server/user";
import { canPostAsPage } from "@/lib/utils/server/permission";
import { getViewerContext, canViewPost } from "@/lib/utils/server/visibility";

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
	visibility: true,
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

		// Draft posts are only visible to the author
		if (post.status === "DRAFT" && post.userId !== viewer.userId) {
			return notFound("Post not found");
		}

		// Visibility gate: PRIVATE posts are 404 for unauthorized viewers
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
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify post exists and check authorization
		const existing = await prisma.post.findUnique({
			where: { id },
			select: { userId: true, pageId: true, content: true },
		});

		if (!existing) {
			return notFound("Post not found");
		}

		const isAuthor = existing.userId === ctx.userId;
		const isPageEditor = existing.pageId
			? await canPostAsPage(ctx.userId, existing.pageId)
			: false;

		if (!isAuthor && !isPageEditor) {
			return NextResponse.json(
				{ error: "You can only edit your own posts" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, content, tags, topics, pinnedAt, status, pageId } = data;

		// If switching author page, verify permission for the new page
		if (pageId !== undefined) {
			if (pageId !== null) {
				const allowed = await canPostAsPage(ctx.userId, pageId);
				if (!allowed) {
					return badRequest("You don't have permission to post as this page");
				}
			} else if (existing.userId !== ctx.userId) {
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
		if (pageId !== undefined) updateData.pageId = pageId;
		if (title !== undefined) updateData.title = title?.trim() || null;
		if (content !== undefined) updateData.content = content.trim();
		if (processedTags !== undefined) updateData.tags = processedTags;
		if (topics !== undefined) updateData.topics = Array.isArray(topics) ? topics : [];
		if (pinnedAt !== undefined) updateData.pinnedAt = pinnedAt === null ? null : new Date(pinnedAt);
		if (status === "PUBLISHED" || status === "DRAFT") {
			if (status === "PUBLISHED") {
				// Use incoming content if being set now, otherwise check current content
				const publishContent = content !== undefined ? content.trim() : existing.content;
				if (!publishContent || publishContent.trim().length === 0) {
					return badRequest("Cannot publish a post with empty content");
				}
			}
			updateData.status = status;
		}

		const post = await prisma.post.update({
			where: { id },
			data: updateData,
			select: postFields,
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
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { id } = await params;

		// Verify post exists and belongs to user
		const existing = await prisma.post.findUnique({
			where: { id },
			select: { userId: true },
		});

		if (!existing) {
			return notFound("Post not found");
		}

		if (existing.userId !== ctx.userId) {
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
