import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getProjectById } from "@/lib/utils/server/project";
import { getPostsForProject, createPost } from "@/lib/utils/server/post";
import { unauthorized, notFound, badRequest, serverError } from "@/lib/utils/errors";
import { getOwnerIdForUser, ownerOwnsProject } from "@/lib/utils/server/owner";

// GET /api/projects/[id]/posts - Get all posts for a project
// Public endpoint (anyone can view project posts)
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;

	try {
		// Verify project exists
		const project = await getProjectById(id);
		if (!project) {
			return notFound("Project not found");
		}

		const posts = await getPostsForProject(id);
		return NextResponse.json(posts);
	} catch (error) {
		console.error("Error fetching posts:", error);
		return serverError("Failed to fetch posts");
	}
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const session = await auth();

	if (!session?.user?.id) {
		return unauthorized();
	}

	const { id } = await params;

	try {
		// Verify project exists and user owns it (via Owner)
		const project = await getProjectById(id);
		if (!project) {
			return notFound("Project not found");
		}

		const ownerId = await getOwnerIdForUser(session.user.id, session.user.activeOwnerId);
		if (!ownerId || !(await ownerOwnsProject(ownerId, id))) {
			return NextResponse.json(
				{ error: "Only the project owner can create posts" },
				{ status: 403 }
			);
		}

		const data = await request.json();
		const { title, content } = data;

		// Validate content is provided
		if (!content || typeof content !== "string" || content.trim().length === 0) {
			return badRequest("Content is required and cannot be empty");
		}

		// Validate title if provided
		if (title !== undefined && title !== null && typeof title !== "string") {
			return badRequest("Title must be a string");
		}

		const post = await createPost(session.user.id, {
			projectId: id,
			title: title?.trim() || null,
			content: content.trim(),
		});

		return NextResponse.json(post, { status: 201 });
	} catch (error) {
		console.error("Error creating post:", error);
		if (error instanceof Error && error.message === "Project not found") {
			return notFound("Project not found");
		}
		return serverError("Failed to create post");
	}
}
