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

// ─── Context ────────────────────────────────────────────────────────────────

export type InlineEditSessionContextType = {
	canEdit: boolean;
	dirtyFields: Record<string, unknown>;
	saving: boolean;
	error: string | null;
	/**
	 * Increments each time cancelAll() is called.
	 * Parent components watch this to reset their per-field state.
	 */
	cancelRevision: number;
	setDirty: (fieldName: string, value: unknown, originalValue: unknown) => void;
	clearDirty: (fieldName: string) => void;
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
	onSave: (patch: Partial<T>) => Promise<T | void>;
	onSaved?: (updated: T) => void;
	canEdit: boolean;
	children: ReactNode;
};

export function InlineEditSession<T extends Record<string, unknown>>({
	resource,
	onSave,
	onSaved,
	canEdit,
	children,
}: InlineEditSessionProps<T>) {
	// fieldName → current pending value
	const [dirtyFields, setDirtyFields] = useState<Record<string, unknown>>({});
	// fieldName → snapshot of the original value at edit start (for dirty comparison)
	const originalValuesRef = useRef<Record<string, unknown>>({});
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [cancelRevision, setCancelRevision] = useState(0);

	const dirtyCount = Object.keys(dirtyFields).length;

	const setDirty = useCallback(
		(fieldName: string, value: unknown, originalValue: unknown) => {
			originalValuesRef.current[fieldName] = originalValue;
			// If the new value deep-equals the original, clear the dirty flag
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

	const saveAll = useCallback(async () => {
		if (saving || dirtyCount === 0) return;
		setSaving(true);
		setError(null);
		try {
			const patch = dirtyFields as Partial<T>;
			const updated = await onSave(patch);
			if (updated && onSaved) {
				onSaved(updated as T);
			}
			setDirtyFields({});
			originalValuesRef.current = {};
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	}, [saving, dirtyCount, dirtyFields, onSave, onSaved]);

	const cancelAll = useCallback(() => {
		setDirtyFields({});
		originalValuesRef.current = {};
		setError(null);
		// Signal parent components to revert their field states
		setCancelRevision((n) => n + 1);
	}, []);

	// Warn before unload if there are unsaved changes
	useEffect(() => {
		const handleBeforeUnload = (e: BeforeUnloadEvent) => {
			if (dirtyCount > 0) {
				e.preventDefault();
			}
		};
		window.addEventListener("beforeunload", handleBeforeUnload);
		return () => window.removeEventListener("beforeunload", handleBeforeUnload);
	}, [dirtyCount]);

	const ctx: InlineEditSessionContextType = {
		canEdit,
		dirtyFields,
		saving,
		error,
		cancelRevision,
		setDirty,
		clearDirty,
		saveAll,
		cancelAll,
	};

	return (
		<InlineEditSessionContext.Provider value={ctx}>
			{children}
			<InlineEditSessionBar
				dirtyCount={dirtyCount}
				saving={saving}
				error={error}
				onSave={saveAll}
				onCancel={cancelAll}
			/>
		</InlineEditSessionContext.Provider>
	);
}
