import { prisma } from "@/lib/utils/server/prisma";
import { success, serverError } from "@/lib/utils/server/api-response";

/**
 * GET /api/topics
 * List all topics
 */
export async function GET() {
	try {
		const topics = await prisma.topic.findMany({
			orderBy: { label: "asc" },
		});

		return success({
			topics: topics.map((t) => ({
				id: t.id,
				label: t.label,
				parentId: t.parentId,
				synonyms: t.synonyms,
			})),
		});
	} catch (error) {
		console.error("GET /api/topics error:", error);
		return serverError();
	}
}
