import { handleListComments, handleCreateComment } from "@/lib/utils/server/comment-routes";

// GET /api/posts/[id]/comments — list a post's comments.
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	return handleListComments("post", id);
}

// POST /api/posts/[id]/comments — add a comment (auth required; may comment "as" a managed page).
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	return handleCreateComment("post", request, id);
}
