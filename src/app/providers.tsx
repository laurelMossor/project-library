"use client";

import { SessionProvider } from "next-auth/react";
import { SessionProvider as AppSessionProvider } from "@/lib/contexts/SessionContext";
import { Session } from "next-auth";

interface ProvidersProps {
	children: React.ReactNode;
	session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
	return (
		<SessionProvider session={session}>
			<AppSessionProvider session={session}>
				{children}
			</AppSessionProvider>
		</SessionProvider>
	);
}
