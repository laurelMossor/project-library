"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CardEntity, CardUser, CardPage, CardPageWithRole } from "@/lib/types/card";
import { API_ME_USER, API_ME_PAGE, API_ME_PAGES, API_SESSION_ACTIVE_PAGE } from "@/lib/const/routes";

interface ActiveProfileContextValue {
	/** The resolved entity the user is currently acting as (user or page) */
	activeEntity: CardEntity | null;
	/** Raw active page ID from session (null = personal identity) */
	activePageId: string | null;
	/** The user's own identity — always available once loaded */
	currentUser: CardUser | null;
	/** All pages the user can act as (ADMIN/EDITOR only), lazy-loaded */
	pages: CardPageWithRole[];
	/**
	 * Switch active profile. Pass null for personal identity, a pageId for a page.
	 * Internally calls PUT /api/session/active-page (page) or DELETE (personal).
	 */
	switchProfile: (pageId: string | null) => Promise<void>;
	/** Explicitly load the pages list. Call this when opening a profile switcher. */
	fetchPages: () => Promise<void>;
	loading: boolean;
	error: string | null;
}

const ActiveProfileCtx = createContext<ActiveProfileContextValue | undefined>(undefined);

export function ActiveProfileProvider({ children }: { children: ReactNode }) {
	const { data: session, update: updateSession } = useSession();
	const activePageId = session?.user?.activePageId ?? null;

	const [currentUser, setCurrentUser] = useState<CardUser | null>(null);
	const [activeEntity, setActiveEntity] = useState<CardEntity | null>(null);
	const [pages, setPages] = useState<CardPageWithRole[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Fetch the current user once when session is established
	useEffect(() => {
		if (!session?.user?.id) return;
		fetch(API_ME_USER)
			.then((r) => (r.ok ? r.json() : null))
			.then((user) => { if (user?.id) setCurrentUser(user as CardUser); })
			.catch(() => {});
	}, [session?.user?.id]);

	// Resolve activeEntity whenever currentUser or activePageId changes.
	// We wait for currentUser to be loaded before trying to resolve — this ensures
	// that switching back to personal identity always has a user to display.
	useEffect(() => {
		if (!currentUser) return;

		if (!activePageId) {
			setActiveEntity(currentUser);
			return;
		}

		fetch(API_ME_PAGE)
			.then((r) => (r.ok ? r.json() : null))
			.then((page) => { if (page?.id) setActiveEntity(page as CardPage); })
			.catch(() => {});
	}, [currentUser, activePageId]);

	// eslint-disable-next-line react-hooks/exhaustive-deps
	async function fetchPages() {
		try {
			const r = await fetch(API_ME_PAGES);
			if (!r.ok) return;
			const data: Array<CardPageWithRole & Record<string, unknown>> = await r.json();
			// Only ADMIN/EDITOR can act as a page
			setPages(
				data
					.filter((p) => p.role === "ADMIN" || p.role === "EDITOR")
			.map((p) => ({
				id: p.id,
				name: p.name,
				handle: p.handle,
				avatarImageId: p.avatarImageId,
				avatarImage: p.avatarImage as { url: string } | null | undefined,
				role: p.role,
			}))
			);
		} catch {
			// silently fail — pages list is non-critical
		}
	}

	const switchProfile = async (pageId: string | null) => {
		setLoading(true);
		setError(null);

		try {
			if (pageId) {
				const res = await fetch(API_SESSION_ACTIVE_PAGE, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ activePageId: pageId }),
				});
				if (!res.ok) {
					const data = await res.json().catch(() => ({}));
					setError((data as { error?: string }).error || "Failed to switch profile");
					return;
				}
				await updateSession({ activePageId: pageId });
				// Fetch the new active page entity
				const pageRes = await fetch(API_ME_PAGE);
				if (pageRes.ok) {
					const page = await pageRes.json();
					if (page?.id) setActiveEntity(page as CardPage);
				}
			} else {
				const res = await fetch(API_SESSION_ACTIVE_PAGE, { method: "DELETE" });
				if (!res.ok) {
					setError("Failed to switch profile");
					return;
				}
				await updateSession({ activePageId: null });
				setActiveEntity(currentUser);
			}
		} catch {
			setError("Failed to switch profile");
		} finally {
			setLoading(false);
		}
	};

	return (
		<ActiveProfileCtx.Provider
			value={{ activeEntity, activePageId, currentUser, pages, switchProfile, fetchPages, loading, error }}
		>
			{children}
		</ActiveProfileCtx.Provider>
	);
}

export function useActiveProfile() {
	const context = useContext(ActiveProfileCtx);
	if (context === undefined) {
		throw new Error("useActiveProfile must be used within an ActiveProfileProvider");
	}
	return context;
}
