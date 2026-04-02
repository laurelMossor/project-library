"use client";

import { SessionProvider } from "next-auth/react";
import { ActiveProfileProvider } from "@/lib/contexts/ActiveProfileContext";
import { UnreadCountProvider } from "@/lib/contexts/UnreadCountContext";
import { Session } from "next-auth";

interface ProvidersProps {
	children: React.ReactNode;
	session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
	return (
		<SessionProvider session={session}>
			<ActiveProfileProvider>
				<UnreadCountProvider>
					{children}
				</UnreadCountProvider>
			</ActiveProfileProvider>
		</SessionProvider>
	);
}
