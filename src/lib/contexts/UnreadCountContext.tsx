"use client";

import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { API_MESSAGES_UNREAD_COUNT } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";

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

const defaultData: UnreadData = { personal: 0, pages: {} };

const UnreadCountCtx = createContext<UnreadCountContextValue | undefined>(undefined);

export function UnreadCountProvider({ children }: { children: ReactNode }) {
	const { data: session } = useSession();
	const isLoggedIn = hasSession(session);
	const activePageId = session?.user?.activePageId ?? null;

	const [unreadData, setUnreadData] = useState<UnreadData>(defaultData);

	const refresh = useCallback(() => {
		if (!isLoggedIn) return;
		fetch(API_MESSAGES_UNREAD_COUNT)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => { if (data) setUnreadData(data as UnreadData); })
			.catch(() => {});
	}, [isLoggedIn]);

	// Re-fetch whenever active profile changes
	useEffect(() => {
		if (!isLoggedIn) {
			setUnreadData(defaultData);
			return;
		}
		refresh();
	// activePageId is the dependency that changes on profile switch
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoggedIn, activePageId]);

	// 60-second poll (visibility-gated)
	useEffect(() => {
		if (!isLoggedIn) return;
		const id = setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, 60000);
		return () => clearInterval(id);
	}, [isLoggedIn, refresh]);

	// Listen for imperative refresh after mark-as-read
	useEffect(() => {
		window.addEventListener("messages:read", refresh);
		return () => window.removeEventListener("messages:read", refresh);
	}, [refresh]);

	const activeCount = activePageId
		? (unreadData.pages[activePageId] ?? 0)
		: unreadData.personal;

	return (
		<UnreadCountCtx.Provider value={{ unreadData, activeCount, refresh }}>
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
