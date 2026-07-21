"use client";

import { createContext, useContext, ReactNode } from "react";
import { API_MESSAGES_UNREAD_COUNT } from "@/lib/const/routes";
import { useIdentityScopedCounts } from "@/lib/hooks/useIdentityScopedCounts";

interface UnreadData {
	personal: number;
	pages: Record<string, number>;
}

interface UnreadCountContextValue {
	unreadData: UnreadData;
	/** Count for the currently active profile (personal or the active page). */
	activeCount: number;
	refresh: () => void;
}

const UnreadCountCtx = createContext<UnreadCountContextValue | undefined>(undefined);

export function UnreadCountProvider({ children }: { children: ReactNode }) {
	// The poll/visibility/profile-scope/refresh machinery lives in the shared hook — see
	// NotificationContext for the sibling that reuses it.
	const { personal, pages, activeCount, refresh } = useIdentityScopedCounts(
		API_MESSAGES_UNREAD_COUNT,
		"messages:read",
	);

	return (
		<UnreadCountCtx.Provider value={{ unreadData: { personal, pages }, activeCount, refresh }}>
			{children}
		</UnreadCountCtx.Provider>
	);
}

export function useUnreadCount() {
	const context = useContext(UnreadCountCtx);
	if (context === undefined) {
		throw new Error("useUnreadCount must be used within an UnreadCountProvider");
	}
	return context;
}
