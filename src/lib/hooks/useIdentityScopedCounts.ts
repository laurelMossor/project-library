"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import { hasSession } from "@/lib/utils/auth-client";

/** Per-identity counts: the personal inbox plus one entry per managed page. */
export interface IdentityCounts {
	personal: number;
	pages: Record<string, number>;
}

export interface IdentityScopedCounts extends IdentityCounts {
	/** Count for the currently active identity (personal, or the active page). */
	activeCount: number;
	refresh: () => void;
}

const EMPTY: IdentityCounts = { personal: 0, pages: {} };

/**
 * Shared machinery for an identity-scoped `{ personal, pages }` count surface: a 60s
 * visibility-gated poll, a refetch on active-profile change, and an imperative refresh via a window
 * event. Both the message unread-count and the activity-notification count contexts consume this —
 * one implementation, parameterized by endpoint + refresh-event name.
 */
export function useIdentityScopedCounts(endpoint: string, refreshEvent: string): IdentityScopedCounts {
	const { data: session } = useSession();
	const isLoggedIn = hasSession(session);
	const activePageId = session?.user?.activePageId ?? null;

	const [data, setData] = useState<IdentityCounts>(EMPTY);

	const refresh = useCallback(() => {
		if (!isLoggedIn) return;
		fetch(endpoint)
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => { if (d) setData(d as IdentityCounts); })
			.catch(() => {});
	}, [isLoggedIn, endpoint]);

	// Re-fetch on login and whenever the active profile changes.
	useEffect(() => {
		if (!isLoggedIn) { setData(EMPTY); return; }
		refresh();
	// activePageId is the dependency that changes on profile switch
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoggedIn, activePageId]);

	// 60-second poll (visibility-gated).
	useEffect(() => {
		if (!isLoggedIn) return;
		const id = setInterval(() => {
			if (document.visibilityState === "visible") refresh();
		}, 60000);
		return () => clearInterval(id);
	}, [isLoggedIn, refresh]);

	// Imperative refresh after a mark-as-read.
	useEffect(() => {
		window.addEventListener(refreshEvent, refresh);
		return () => window.removeEventListener(refreshEvent, refresh);
	}, [refreshEvent, refresh]);

	const activeCount = activePageId ? (data.pages[activePageId] ?? 0) : data.personal;

	return { personal: data.personal, pages: data.pages, activeCount, refresh };
}
