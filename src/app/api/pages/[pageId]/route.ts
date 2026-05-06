import { NextResponse } from "next/server";
import { prisma } from "@/lib/utils/server/prisma";
import { getSessionContext } from "@/lib/utils/server/session";
import { unauthorized, notFound, serverError } from "@/lib/utils/errors";
import { canManagePage } from "@/lib/utils/server/permission";
import { getPageById, updatePageProfile, publicPageFields } from "@/lib/utils/server/page";
import { processElementsPayload } from "@/lib/utils/server/profile-element";
import type { SavePayload } from "@/lib/types/inline-edit";

type RouteParams = { params: Promise<{ pageId: string }> };

/**
 * GET /api/pages/[pageId]
 * Get a page by ID
 * Public endpoint
 */
export async function GET(_request: Request, { params }: RouteParams) {
	try {
		const { pageId } = await params;
		const page = await getPageById(pageId);

		if (!page) {
			return notFound("Page not found");
		}

		return NextResponse.json(page);
	} catch (error) {
		console.error("GET /api/pages/[pageId] error:", error);
		return serverError("Failed to fetch page");
	}
}

/**
 * PUT /api/pages/[pageId]
 * Update a page profile. Accepts a structured SavePayload with scalar fields
 * and optional element create/update/delete operations, all in one transaction.
 * Protected endpoint (requires ADMIN permission).
 */
export async function PUT(request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to manage this page");
		}

		const body = (await request.json()) as SavePayload;
		const { fields = {}, elements } = body;

		const page = await prisma.$transaction(async () => {
			// Apply scalar field updates
			const updatedPage = await updatePageProfile(pageId, fields as Parameters<typeof updatePageProfile>[1]);

			// Apply element operations
			if (elements) {
				await processElementsPayload({ pageId }, elements);
			}

			// Re-fetch with elements included
			return prisma.page.findUnique({
				where: { id: pageId },
				select: publicPageFields,
			});
		});

		return NextResponse.json(page);
	} catch (error) {
		console.error("PUT /api/pages/[pageId] error:", error);
		return serverError("Failed to update page");
	}
}

/**
 * DELETE /api/pages/[pageId]
 * Delete a page
 * Protected endpoint (requires ADMIN permission)
 */
export async function DELETE(_request: Request, { params }: RouteParams) {
	try {
		const ctx = await getSessionContext();
		if (!ctx) {
			return unauthorized();
		}

		const { pageId } = await params;
		const isAdmin = await canManagePage(ctx.userId, pageId);
		if (!isAdmin) {
			return unauthorized("You do not have permission to delete this page");
		}

		await prisma.page.delete({ where: { id: pageId } });

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("DELETE /api/pages/[pageId] error:", error);
		return serverError("Failed to delete page");
	}
}
