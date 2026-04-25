"use client";

import { useContext } from "react";
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
