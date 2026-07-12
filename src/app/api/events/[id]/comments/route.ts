import { handleListComments, handleCreateComment } from "@/lib/utils/server/comment-routes";

// GET /api/events/[id]/comments — list an event's comments.
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	return handleListComments("event", id);
}

// POST /api/events/[id]/comments — add a comment (auth required; may comment "as" a managed page).
export async function POST(
	request: Request,
	{ params }: { params: Promise<{ id: string }> }
) {
	const { id } = await params;
	return handleCreateComment("event", request, id);
}
