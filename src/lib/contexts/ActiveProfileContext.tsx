"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useSession } from "next-auth/react";
import { CardEntity, CardUser, CardPage, CardPageWithRole } from "@/lib/types/card";
import { API_ME_PAGE, API_ME_PAGES, API_SESSION_ACTIVE_PAGE } from "@/lib/const/routes";
import { isActingRole } from "@/lib/const/roles";

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

/**
 * Resolve which entity the nav shows. Personal → the user; acting-as-page → the fresh
 * server page prop when it matches the session's activePageId, otherwise keep whatever
 * was already showing (an optimistic switch that the prop hasn't caught up to) and fall
 * back to personal so the tag never blanks. Shared by the initial state and the re-sync
 * effect so the two can't drift.
 */
function resolveActiveEntity(
	currentUser: CardUser | null,
	activePageId: string | null,
	activePage: CardPage | null,
	prev: CardEntity | null,
): CardEntity | null {
	if (!currentUser) return null;
	if (!activePageId) return currentUser;
	if (activePage && activePage.id === activePageId) return activePage;
	return prev ?? currentUser;
}

interface ActiveProfileProviderProps {
	children: ReactNode;
	/** Server-resolved identity, seeded from the root layout (see getActingIdentity). */
	initialCurrentUser: CardUser | null;
	initialActivePage: CardPage | null;
}

export function ActiveProfileProvider({ children, initialCurrentUser, initialActivePage }: ActiveProfileProviderProps) {
	const { data: session, update: updateSession } = useSession();
	const activePageId = session?.user?.activePageId ?? null;

	const [currentUser, setCurrentUser] = useState<CardUser | null>(initialCurrentUser);
	// Seed from the server props so the acting-identity tag paints correctly on the first
	// frame instead of blanking until the resolver effect runs. Uses the same resolver the
	// effect does, so seed and re-sync stay in lockstep.
	const [activeEntity, setActiveEntity] = useState<CardEntity | null>(() =>
		resolveActiveEntity(initialCurrentUser, activePageId, initialActivePage, null),
	);
	const [pages, setPages] = useState<CardPageWithRole[]>([]);
	const [loading, setLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);

	// Sync currentUser from the server prop. The layout re-runs getActingIdentity on every
	// server render — including router.refresh() after an avatar/profile edit — so a fresh
	// prop is how the nav learns about the change (this replaces the old client fetch-cache
	// that never invalidated). Still gated on the *client* session id so an out-of-band
	// session loss (logout, token-version bump) clears the identity without a reload.
	// Keyed on a primitive signature, not the object reference, so it fires exactly when the
	// identity's displayed fields change — never on an incidental re-render.
	const userSig = initialCurrentUser
		? `${initialCurrentUser.id}|${initialCurrentUser.handle}|${initialCurrentUser.displayName ?? ""}|${initialCurrentUser.avatarImageId ?? ""}|${initialCurrentUser.avatarImage?.url ?? ""}`
		: null;
	useEffect(() => {
		if (!session?.user?.id) {
			setCurrentUser(null);
			setPages([]); // drop the lazy-loaded switcher list on logout
			return;
		}
		setCurrentUser(initialCurrentUser);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [session?.user?.id, userSig]);

	// Resolve activeEntity from the synced identity + the server-provided active page.
	// Personal → currentUser. Acting-as-page → the fresh initialActivePage prop. When the
	// page prop hasn't caught up to a just-switched pageId, keep the prior entity (switchProfile
	// sets it optimistically — see below) so a page→page switch shows no personal-flash; when
	// there's nothing to keep (e.g. a stale/forbidden activePageId at load), fall back to
	// personal so the nav tag never blanks.
	const pageSig = initialActivePage
		? `${initialActivePage.id}|${initialActivePage.handle}|${initialActivePage.name}|${initialActivePage.avatarImageId ?? ""}|${initialActivePage.avatarImage?.url ?? ""}`
		: null;
	useEffect(() => {
		setActiveEntity((prev) => resolveActiveEntity(currentUser, activePageId, initialActivePage, prev));
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentUser, activePageId, pageSig]);

	async function fetchPages() {
		try {
			const r = await fetch(API_ME_PAGES);
			if (!r.ok) return;
			const data: Array<CardPageWithRole & Record<string, unknown>> = await r.json();
			// Only ADMIN/EDITOR can act as a page
			setPages(
				data
					.filter((p) => isActingRole(p.role))
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
				// Optimistically set the new active page entity for an instant switch. This also
				// feeds the resolver's keep-prior branch: on the next server render the fresh
				// initialActivePage prop confirms this value. Keep this fetch and that branch in
				// sync — removing this reintroduces a personal-flash on page→page switches.
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
