"use client";

import { SessionProvider } from "next-auth/react";
import { OwnerProvider } from "@/lib/contexts/OwnerContext";
import { Session } from "next-auth";

interface ProvidersProps {
	children: React.ReactNode;
	session: Session | null;
}

export function Providers({ children, session }: ProvidersProps) {
	return (
		<SessionProvider session={session}>
			<OwnerProvider session={session}>
				{children}
			</OwnerProvider>
		</SessionProvider>
	);
}
