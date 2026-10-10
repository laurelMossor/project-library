"use client";

import { useContext, useEffect, useRef } from "react";
import { InlineEditSessionContext, type InlineEditSessionContextType } from "@/lib/components/inline-editable/InlineEditSession";

/**
 * Consumer hook for InlineEditSession context.
 *
 * Use inside any component that is a descendant of <InlineEditSession> to
 * access the shared dirty-field state and save/cancel callbacks.
 *
 * Returns null when there is no parent session (component is rendered outside
 * a session, e.g. in a read-only context).
 */
export function useInlineEditSession(): InlineEditSessionContextType | null {
	return useContext(InlineEditSessionContext);
}

/**
 * Runs `onClose` whenever editing ends — Cancel, or a successful Save / Publish —
 * so a page can close its open field. Never fires on mount.
 */
export function useOnEditingClosed(onClose: () => void) {
	const closeRevision = useContext(InlineEditSessionContext)?.closeRevision ?? 0;
	// Latest callback without re-running the effect when its identity changes.
	const onCloseRef = useRef(onClose);
	onCloseRef.current = onClose;
	useEffect(() => {
		if (closeRevision === 0) return;
		onCloseRef.current();
	}, [closeRevision]);
}
