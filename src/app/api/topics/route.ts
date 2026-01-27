import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { serverError } from "@/lib/utils/errors";

/**
 * GET /api/topics
 * List all topics
 * Public endpoint
 */
export async function GET() {
	try {
		const topics = await prisma.topic.findMany({
			orderBy: { label: "asc" },
		});

		const topicsList = topics.map((t) => ({
			id: t.id,
			label: t.label,
			parentId: t.parentId,
			synonyms: t.synonyms,
		}));

		return NextResponse.json(topicsList);
	} catch (error) {
		console.error("GET /api/topics error:", error);
		return serverError();
	}
}
