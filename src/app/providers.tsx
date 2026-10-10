"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { ActiveProfileProvider } from "@/lib/contexts/ActiveProfileContext";
import { UnreadCountProvider } from "@/lib/contexts/UnreadCountContext";
import { NotificationProvider } from "@/lib/components/notifications/NotificationContext";
import { Session } from "next-auth";
import type { CardUser, CardPageWithRole } from "@/lib/types/card";
import { API_AUTH_SESSION } from "@/lib/const/routes";
import { hasSession, sessionReadConfirmsLogout } from "@/lib/utils/auth-client";

interface ProvidersProps {
	children: React.ReactNode;
	session: Session | null;
	/** Server-resolved acting identity, seeded into ActiveProfileProvider (see getActingIdentity). */
	currentUser: CardUser | null;
	activePage: CardPageWithRole | null;
}

export function Providers({ children, session, currentUser, activePage }: ProvidersProps) {
	return (
		// Focus/interval refetch is off. NextAuth writes a failed or user-less session response
		// straight into client state and then won't try again, so the nav said "Log in" while the
		// cookie was still valid (a reload re-seeds from the server and skips that refetch).
		// SessionRecheck owns the invalidation check instead.
		<SessionProvider session={session} refetchOnWindowFocus={false}>
			<SessionRecheck serverSession={session} />
			<ActiveProfileProvider initialCurrentUser={currentUser} initialActivePage={activePage}>
				<UnreadCountProvider>
					<NotificationProvider>
						{children}
					</NotificationProvider>
				</UnreadCountProvider>
			</ActiveProfileProvider>
		</SessionProvider>
	);
}

/**
 * On return to the tab (and every 5 min), re-read the session. A confirmed logout refreshes the
 * server render so the nav drops the profile. A failed read is ignored — it is not a logout.
 */
function SessionRecheck({ serverSession }: { serverSession: Session | null }) {
	const router = useRouter();
	const serverSessionRef = useRef(serverSession);
	serverSessionRef.current = serverSession;

	useEffect(() => {
		let cancelled = false;
		const recheck = async () => {
			if (document.visibilityState !== "visible") return;
			if (!hasSession(serverSessionRef.current)) return;
			try {
				const res = await fetch(API_AUTH_SESSION, { cache: "no-store" });
				if (cancelled) return;
				const body = res.ok ? await res.json() : null;
				if (cancelled || !sessionReadConfirmsLogout(res.ok, body)) return;
				if (!hasSession(serverSessionRef.current)) return;
				router.refresh();
			} catch {
				// Unreadable response. Leave the current login alone.
			}
		};
		const onVisible = () => {
			if (document.visibilityState === "visible") void recheck();
		};
		document.addEventListener("visibilitychange", onVisible);
		const interval = window.setInterval(() => void recheck(), 5 * 60 * 1000);
		return () => {
			cancelled = true;
			document.removeEventListener("visibilitychange", onVisible);
			window.clearInterval(interval);
		};
	}, [router]);

	return null;
}
