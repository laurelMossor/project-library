"use client";

import { createContext, useContext, ReactNode } from "react";
import { API_NOTIFICATIONS_UNREAD_COUNT } from "@/lib/const/routes";
import { useIdentityScopedCounts } from "@/lib/hooks/useIdentityScopedCounts";

interface NotificationCountValue {
	/** Per-identity unread counts (personal + one per managed page) — drives the profile-switcher dots. */
	data: { personal: number; pages: Record<string, number> };
	/** Unread count for the currently active identity — drives the nav bell dot. */
	activeCount: number;
	refresh: () => void;
}

const NotificationCtx = createContext<NotificationCountValue | undefined>(undefined);

/**
 * Identity-scoped activity-notification counts. Reuses the shared poll machinery
 * (`useIdentityScopedCounts`) — the sibling of `UnreadCountProvider`, differing only in endpoint
 * and refresh-event name. Bell list state is fetched on-open by the bell itself; this only tracks
 * the unread badges.
 */
export function NotificationProvider({ children }: { children: ReactNode }) {
	const { personal, pages, activeCount, refresh } = useIdentityScopedCounts(
		API_NOTIFICATIONS_UNREAD_COUNT,
		"notifications:read",
	);

	return (
		<NotificationCtx.Provider value={{ data: { personal, pages }, activeCount, refresh }}>
			{children}
		</NotificationCtx.Provider>
	);
}

export function useNotificationCount() {
	const context = useContext(NotificationCtx);
	if (context === undefined) {
		throw new Error("useNotificationCount must be used within a NotificationProvider");
	}
	return context;
}
