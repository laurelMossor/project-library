import type { ProfileElementKind } from "@prisma/client";

export type { ProfileElementKind };

export type ProfileElementItem = {
	id: string;
	kind: ProfileElementKind;
	userId: string | null;
	pageId: string | null;
	label: string | null;
	value: string;
	caption: string | null;
	url: string | null;
	sortOrder: number;
	visible: boolean;
	createdAt: Date | string;
	updatedAt: Date | string;
};
