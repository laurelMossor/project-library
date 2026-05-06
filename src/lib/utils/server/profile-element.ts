// ⚠️ SERVER-ONLY: uses Prisma. Do not import in client components.

import { prisma } from "./prisma";
import { ProfileElementKind } from "@prisma/client";
import type { ElementCreate, ElementUpdate } from "@/lib/types/inline-edit";

export const profileElementFields = {
	id: true,
	kind: true,
	userId: true,
	pageId: true,
	label: true,
	value: true,
	caption: true,
	url: true,
	sortOrder: true,
	visible: true,
	createdAt: true,
	updatedAt: true,
} as const;

type ElementOwner =
	| { userId: string; pageId?: never }
	| { pageId: string; userId?: never };

export async function listProfileElements(owner: ElementOwner) {
	return prisma.profileElement.findMany({
		where: owner.userId
			? { userId: owner.userId, visible: true }
			: { pageId: owner.pageId, visible: true },
		select: profileElementFields,
		orderBy: { sortOrder: "asc" },
	});
}

export async function createProfileElement(
	owner: ElementOwner,
	data: ElementCreate
) {
	return prisma.profileElement.create({
		data: {
			...(owner.userId ? { userId: owner.userId } : { pageId: owner.pageId }),
			kind: data.kind as ProfileElementKind,
			label: data.label ?? null,
			value: data.value,
			caption: data.caption ?? null,
			url: data.url ?? null,
			sortOrder: data.sortOrder,
		},
		select: profileElementFields,
	});
}

export async function updateProfileElement(
	elementId: string,
	owner: ElementOwner,
	data: Omit<ElementUpdate, "id">
) {
	// Verify ownership before update
	const existing = await prisma.profileElement.findUnique({
		where: { id: elementId },
		select: { userId: true, pageId: true },
	});
	if (!existing) throw new Error("Element not found");
	if (owner.userId && existing.userId !== owner.userId) throw new Error("Forbidden");
	if (owner.pageId && existing.pageId !== owner.pageId) throw new Error("Forbidden");

	const { id: _id, ...rest } = data as Record<string, unknown> & { id?: string };
	return prisma.profileElement.update({
		where: { id: elementId },
		data: rest,
		select: profileElementFields,
	});
}

export async function deleteProfileElements(
	elementIds: string[],
	owner: ElementOwner
) {
	if (elementIds.length === 0) return;
	await prisma.profileElement.deleteMany({
		where: {
			id: { in: elementIds },
			...(owner.userId ? { userId: owner.userId } : { pageId: owner.pageId }),
		},
	});
}

/**
 * Process an elements sub-payload (creates, updates, deletes) inside a
 * transaction-like flow. Caller wraps in prisma.$transaction if needed.
 */
export async function processElementsPayload(
	owner: ElementOwner,
	elements: {
		create?: ElementCreate[];
		update?: ElementUpdate[];
		delete?: string[];
	}
) {
	const results = {
		created: [] as Awaited<ReturnType<typeof createProfileElement>>[],
		updated: [] as Awaited<ReturnType<typeof updateProfileElement>>[],
	};

	if (elements.create?.length) {
		for (const draft of elements.create) {
			const created = await createProfileElement(owner, draft);
			results.created.push(created);
		}
	}

	if (elements.update?.length) {
		for (const { id, ...rest } of elements.update) {
			const updated = await updateProfileElement(id, owner, rest);
			results.updated.push(updated);
		}
	}

	if (elements.delete?.length) {
		await deleteProfileElements(elements.delete, owner);
	}

	return results;
}
