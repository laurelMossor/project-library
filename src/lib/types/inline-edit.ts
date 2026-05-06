/**
 * Structured payload passed to InlineEditSession's onSave handler.
 * All sessions use this shape — resources without elements simply ignore
 * the elements key.
 */
export type ElementCreate = {
	kind: string;
	label?: string | null;
	value: string;
	caption?: string | null;
	url?: string | null;
	sortOrder: number;
};

export type ElementUpdate = {
	id: string;
} & Record<string, unknown>;

export type SavePayload = {
	fields: Record<string, unknown>;
	elements?: {
		create?: ElementCreate[];
		update?: ElementUpdate[];
		delete?: string[];
	};
};

/** Client-side draft for a not-yet-saved element. Uses a temporary ID. */
export type ElementDraft = {
	tempId: string;
	kind: string;
	label?: string | null;
	value: string;
	caption?: string | null;
	url?: string | null;
	sortOrder: number;
};
