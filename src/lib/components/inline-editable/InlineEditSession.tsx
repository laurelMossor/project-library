"use client";

import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
	type ReactNode,
} from "react";
import { InlineEditSessionBar } from "./InlineEditSessionBar";
import type { ElementDraft, ElementCreate, ElementUpdate, SavePayload } from "@/lib/types/inline-edit";

// ─── Context ────────────────────────────────────────────────────────────────

export type InlineEditSessionContextType = {
	canEdit: boolean;
	dirtyFields: Record<string, unknown>;
	dirtyFiles: Record<string, File>;
	/** Total unsaved changes: scalar fields + element ops + pending file uploads. */
	changeCount: number;
	pendingCreates: ElementDraft[];
	pendingDeletes: string[];
	saving: boolean;
	error: string | null;
	/**
	 * Increments each time cancelAll() is called.
	 * Parent components watch this to close any open editingField / reset local input state.
	 */
	cancelRevision: number;
	setDirty: (fieldName: string, value: unknown, originalValue: unknown) => void;
	clearDirty: (fieldName: string) => void;
	setDirtyFile: (key: string, file: File | null) => void;
	addCreate: (draft: ElementDraft) => void;
	removeCreate: (tempId: string) => void;
	updateCreate: (tempId: string, field: string, value: unknown) => void;
	markDeleted: (elementId: string) => void;
	unmarkDeleted: (elementId: string) => void;
	saveAll: () => Promise<void>;
	publish: () => Promise<void>;
	cancelAll: () => void;
};

export const InlineEditSessionContext =
	createContext<InlineEditSessionContextType | null>(null);

export function useInlineEditSessionContext() {
	return useContext(InlineEditSessionContext);
}

// ─── Provider ───────────────────────────────────────────────────────────────

type InlineEditSessionProps<T extends Record<string, unknown>> = {
	resource: T;
	onSave: (payload: SavePayload) => Promise<T | void>;
	onSaved?: (updated: T) => void;
	/** Called after field save completes, for any pending file uploads. */
	onCommitFiles?: (files: Record<string, File>) => Promise<Partial<T> | void>;
	canEdit: boolean;
	/** Show the Publish affordance in the save bar (owner editing a draft). */
	publishable?: boolean;
	/**
	 * Return true when the current resource state meets publish requirements.
	 * Receives a merged view of the committed resource + current dirty scalars.
	 * When false the Publish button is disabled and publishHint is shown.
	 */
	canPublish?: (current: T) => boolean;
	/** Message shown next to the disabled Publish button when canPublish returns false. */
	publishHint?: string;
	children: ReactNode;
};

export function InlineEditSession<T extends Record<string, unknown>>({
	resource,
	onSave,
	onSaved,
	onCommitFiles,
	canEdit,
	publishable = false,
	canPublish,
	publishHint,
	children,
}: InlineEditSessionProps<T>) {
	const [dirtyFields, setDirtyFields] = useState<Record<string, unknown>>({});
	const [dirtyFiles, setDirtyFilesState] = useState<Record<string, File>>({});
	const originalValuesRef = useRef<Record<string, unknown>>({});
	const [pendingCreates, setPendingCreates] = useState<ElementDraft[]>([]);
	const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	// Synchronous re-entrancy guard — `saving` state is async and stale inside the
	// commit closure, so a fast double-click could fire two concurrent commits.
	const savingRef = useRef(false);
	const [error, setError] = useState<string | null>(null);
	const [cancelRevision, setCancelRevision] = useState(0);

	// Unified change count: scalar fields + element ops + pending file uploads
	const scalarDirtyCount = Object.keys(dirtyFields).filter(
		(k) => !k.startsWith("element:")
	).length;
	const elementUpdateCount = Object.keys(dirtyFields).filter(
		(k) => k.startsWith("element:")
	).length > 0
		? new Set(
			Object.keys(dirtyFields)
				.filter((k) => k.startsWith("element:"))
				.map((k) => k.split(":")[1])
		).size
		: 0;
	const changeCount =
		scalarDirtyCount +
		elementUpdateCount +
		pendingCreates.length +
		pendingDeletes.length +
		Object.keys(dirtyFiles).length;

	// Merged view of resource + current dirty scalar values, used for canPublish
	const scalarDirtyFields: Record<string, unknown> = {};
	for (const [k, v] of Object.entries(dirtyFields)) {
		if (!k.startsWith("element:")) scalarDirtyFields[k] = v;
	}
	const current = { ...resource, ...scalarDirtyFields } as T;
	const publishAllowed = canPublish ? canPublish(current) : true;

	const setDirty = useCallback(
		(fieldName: string, value: unknown, originalValue: unknown) => {
			originalValuesRef.current[fieldName] = originalValue;
			if (JSON.stringify(value) === JSON.stringify(originalValue)) {
				setDirtyFields((prev) => {
					const next = { ...prev };
					delete next[fieldName];
					return next;
				});
			} else {
				setDirtyFields((prev) => ({ ...prev, [fieldName]: value }));
			}
		},
		[]
	);

	const clearDirty = useCallback((fieldName: string) => {
		setDirtyFields((prev) => {
			const next = { ...prev };
			delete next[fieldName];
			return next;
		});
		delete originalValuesRef.current[fieldName];
	}, []);

	const setDirtyFile = useCallback((key: string, file: File | null) => {
		setDirtyFilesState((prev) => {
			if (file === null) {
				const next = { ...prev };
				delete next[key];
				return next;
			}
			return { ...prev, [key]: file };
		});
	}, []);

	const addCreate = useCallback((draft: ElementDraft) => {
		setPendingCreates((prev) => [...prev, draft]);
	}, []);

	const removeCreate = useCallback((tempId: string) => {
		setPendingCreates((prev) => prev.filter((d) => d.tempId !== tempId));
		setDirtyFields((prev) => {
			const next = { ...prev };
			Object.keys(next).forEach((k) => {
				if (k.startsWith(`element:${tempId}:`)) delete next[k];
			});
			return next;
		});
	}, []);

	const updateCreate = useCallback((tempId: string, field: string, value: unknown) => {
		setPendingCreates((prev) =>
			prev.map((d) => (d.tempId === tempId ? { ...d, [field]: value } : d))
		);
	}, []);

	const markDeleted = useCallback((elementId: string) => {
		setPendingDeletes((prev) =>
			prev.includes(elementId) ? prev : [...prev, elementId]
		);
	}, []);

	const unmarkDeleted = useCallback((elementId: string) => {
		setPendingDeletes((prev) => prev.filter((id) => id !== elementId));
	}, []);

	const undoLastDelete = useCallback(() => {
		setPendingDeletes((prev) => prev.slice(0, -1));
	}, []);

	/**
	 * Core commit function — handles both plain Save and Save-and-publish.
	 * When publish=true, injects status:"PUBLISHED" into the fields payload.
	 * A publish with zero field/element changes still goes through (no early-return).
	 */
	const commit = useCallback(async ({ publish = false }: { publish?: boolean } = {}) => {
		if (savingRef.current) return; // re-entrancy guard (synchronous)
		// For plain saves, skip if nothing is dirty
		if (!publish && changeCount === 0) return;
		savingRef.current = true;
		setSaving(true);
		setError(null);
		try {
			const fields: Record<string, unknown> = {};
			const elementUpdateMap: Record<string, Record<string, unknown>> = {};

			for (const [key, value] of Object.entries(dirtyFields)) {
				if (key.startsWith("element:")) {
					const parts = key.split(":");
					const elementId = parts[1];
					const fieldName = parts.slice(2).join(":");
					if (!elementUpdateMap[elementId]) elementUpdateMap[elementId] = {};
					elementUpdateMap[elementId][fieldName] = value;
				} else {
					fields[key] = value;
				}
			}

			if (publish) {
				fields.status = "PUBLISHED";
			}

			const elementUpdates: ElementUpdate[] = Object.entries(elementUpdateMap).map(
				([id, updates]) => ({ id, ...updates })
			);
			const creates: ElementCreate[] = pendingCreates.map(({ tempId: _tempId, ...rest }) => rest);

			const payload: SavePayload = {
				fields,
				...(elementUpdates.length > 0 || creates.length > 0 || pendingDeletes.length > 0
					? {
						elements: {
							...(creates.length > 0 ? { create: creates } : {}),
							...(elementUpdates.length > 0 ? { update: elementUpdates } : {}),
							...(pendingDeletes.length > 0 ? { delete: [...pendingDeletes] } : {}),
						},
					}
					: {}),
			};

			const saved = await onSave(payload);

			// Reflect the field/publish result and clear committed scalar + element state
			// BEFORE the file commit. Otherwise a file-upload failure after a successful
			// publish would strand the client in "draft" while the server is PUBLISHED.
			if (saved && onSaved) {
				onSaved(saved as T);
			}
			setDirtyFields({});
			originalValuesRef.current = {};
			setPendingCreates([]);
			setPendingDeletes([]);

			// Then commit any pending file uploads. A failure here keeps only dirtyFiles
			// (for retry) — the field/publish state above is already persisted.
			if (onCommitFiles && Object.keys(dirtyFiles).length > 0) {
				const fileResult = await onCommitFiles(dirtyFiles);
				if (fileResult && onSaved) {
					onSaved((saved ? { ...saved, ...fileResult } : fileResult) as T);
				}
				setDirtyFilesState({});
			}
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			savingRef.current = false;
			setSaving(false);
		}
	}, [changeCount, dirtyFields, dirtyFiles, pendingCreates, pendingDeletes, onSave, onSaved, onCommitFiles]);

	const saveAll = useCallback(() => commit({ publish: false }), [commit]);
	const publish = useCallback(() => commit({ publish: true }), [commit]);

	const cancelAll = useCallback(() => {
		setDirtyFields({});
		originalValuesRef.current = {};
		setPendingCreates([]);
		setPendingDeletes([]);
		setDirtyFilesState({});
		setError(null);
		setCancelRevision((n) => n + 1);
	}, []);

	// Warn before unload if there are unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (changeCount > 0) {
				e.preventDefault();
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [changeCount]);

	const ctx: InlineEditSessionContextType = {
		canEdit,
		dirtyFields,
		dirtyFiles,
		changeCount,
		pendingCreates,
		pendingDeletes,
		saving,
		error,
		cancelRevision,
		setDirty,
		clearDirty,
		setDirtyFile,
		addCreate,
		removeCreate,
		updateCreate,
		markDeleted,
		unmarkDeleted,
		saveAll,
		publish,
		cancelAll,
	};

	return (
		<InlineEditSessionContext.Provider value={ctx}>
			{children}
			<InlineEditSessionBar
				changeCount={changeCount}
				pendingDeleteCount={pendingDeletes.length}
				saving={saving}
				error={error}
				onSave={saveAll}
				onCancel={cancelAll}
				onUndo={undoLastDelete}
				publishable={publishable}
				publishAllowed={publishAllowed}
				publishHint={publishHint}
				onPublish={publish}
			/>
		</InlineEditSessionContext.Provider>
	);
}
