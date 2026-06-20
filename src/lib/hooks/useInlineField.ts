"use client";

import { useCallback } from "react";
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

	// session.setDirty is stable (useCallback in the provider), so memoizing here
	// keeps setValue's identity stable across renders — consumers can safely list
	// it in useCallback/useEffect deps (e.g. EventPageClient's handleLocationSelect).
	const setDirty = session?.setDirty;
	const setValue = useCallback(
		(v: T) => setDirty?.(name, v, original),
		[setDirty, name, original]
	);

	return { value, setValue };
}
