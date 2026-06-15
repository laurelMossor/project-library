"use client";

import { useInlineEditSession } from "./useInlineEditSession";

/**
 * Single-source-of-truth hook for a named field inside an InlineEditSession.
 *
 * Reads from session.dirtyFields when dirty (so the display content always
 * shows the latest unsaved value), writes via session.setDirty on change.
 *
 * Uses `name in dirtyFields` rather than `?? original` so that a field
 * explicitly cleared to null/""/[] reads as cleared (not snapped back to the
 * original value — which would be a bug for nullable fields like location/headline).
 */
export function useInlineField<T>(name: string, original: T) {
	const session = useInlineEditSession();

	const value = (
		session && name in session.dirtyFields ? session.dirtyFields[name] : original
	) as T;

	const setValue = (v: T) => session?.setDirty(name, v, original);

	return { value, setValue };
}
