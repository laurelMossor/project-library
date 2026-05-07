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
	pendingCreates: ElementDraft[];
	pendingDeletes: string[];
	saving: boolean;
	error: string | null;
	/**
	 * Increments each time cancelAll() is called.
	 * Parent components watch this to reset their per-field state.
	 */
	cancelRevision: number;
	setDirty: (fieldName: string, value: unknown, originalValue: unknown) => void;
	clearDirty: (fieldName: string) => void;
	addCreate: (draft: ElementDraft) => void;
	removeCreate: (tempId: string) => void;
	updateCreate: (tempId: string, field: string, value: unknown) => void;
	markDeleted: (elementId: string) => void;
	unmarkDeleted: (elementId: string) => void;
	saveAll: () => Promise<void>;
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
	canEdit: boolean;
	children: ReactNode;
};

// TODO create hook and utilities to break up this file
export function InlineEditSession<T extends Record<string, unknown>>({
	resource: _resource,
	onSave,
	onSaved,
	canEdit,
	children,
}: InlineEditSessionProps<T>) {
	// fieldName → current pending value (scalar fields + element:<id>:<field> entries)
	const [dirtyFields, setDirtyFields] = useState<Record<string, unknown>>({});
	// fieldName → snapshot of original value at edit start
	const originalValuesRef = useRef<Record<string, unknown>>({});
	const [pendingCreates, setPendingCreates] = useState<ElementDraft[]>([]);
	// stack: last element is the most recently deleted (for Undo)
	const [pendingDeletes, setPendingDeletes] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [cancelRevision, setCancelRevision] = useState(0);

	// Unified change count: scalar fields + element ops
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
		pendingDeletes.length;

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

	const addCreate = useCallback((draft: ElementDraft) => {
		setPendingCreates((prev) => [...prev, draft]);
	}, []);

	const removeCreate = useCallback((tempId: string) => {
		setPendingCreates((prev) => prev.filter((d) => d.tempId !== tempId));
		// also clear any dirty fields for this draft
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

	const saveAll = useCallback(async () => {
		if (saving || changeCount === 0) return;
		setSaving(true);
		setError(null);
		try {
			// Separate scalar fields from element update namespaced keys
			const fields: Record<string, unknown> = {};
			const elementUpdateMap: Record<string, Record<string, unknown>> = {};

			for (const [key, value] of Object.entries(dirtyFields)) {
				if (key.startsWith("element:")) {
					const parts = key.split(":");
					// key format: element:<id>:<field>
					const elementId = parts[1];
					const fieldName = parts.slice(2).join(":");
					if (!elementUpdateMap[elementId]) elementUpdateMap[elementId] = {};
					elementUpdateMap[elementId][fieldName] = value;
				} else {
					fields[key] = value;
				}
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

			const updated = await onSave(payload);
			if (updated && onSaved) {
				onSaved(updated as T);
			}
			setDirtyFields({});
			originalValuesRef.current = {};
			setPendingCreates([]);
			setPendingDeletes([]);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}, [saving, changeCount, dirtyFields, pendingCreates, pendingDeletes, onSave, onSaved]);

	const cancelAll = useCallback(() => {
		setDirtyFields({});
		originalValuesRef.current = {};
		setPendingCreates([]);
		setPendingDeletes([]);
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
		pendingCreates,
		pendingDeletes,
		saving,
		error,
		cancelRevision,
		setDirty,
		clearDirty,
		addCreate,
		removeCreate,
		updateCreate,
		markDeleted,
		unmarkDeleted,
		saveAll,
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
			/>
		</InlineEditSessionContext.Provider>
	);
}
