"use client";

import { SessionProvider } from "next-auth/react";
import { ActiveProfileProvider } from "@/lib/contexts/ActiveProfileContext";
import { UnreadCountProvider } from "@/lib/contexts/UnreadCountContext";
import { NotificationProvider } from "@/lib/components/notifications/NotificationContext";
import { Session } from "next-auth";

interface ProvidersProps {
	children: React.ReactNode;
	session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
	return (
		// refetchInterval re-validates the session against the server every 5 min, and
		// refetchOnWindowFocus on tab focus — so a session invalidated out-of-band (password
		// reset, token-version bump) stops looking logged-in without needing a manual reload.
		<SessionProvider session={session} refetchInterval={5 * 60} refetchOnWindowFocus={true}>
			<ActiveProfileProvider>
				<UnreadCountProvider>
					<NotificationProvider>
						{children}
					</NotificationProvider>
				</UnreadCountProvider>
			</ActiveProfileProvider>
		</SessionProvider>
	);
}
