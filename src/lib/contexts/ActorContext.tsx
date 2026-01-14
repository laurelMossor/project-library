"use client";

import { createContext, useContext, ReactNode } from "react";
import { Session } from "next-auth";
import { Actor } from "@/lib/types/actor";

/**
 * ActorContext provides the active actor (User or Org) based on session
 * This allows components to easily access the current actor without prop drilling
 */

interface ActorContextValue {
	session: Session | null;
	activeOrgId: string | undefined;
	// Note: getActiveActor is async and requires DB access, so it's not included here
	// Components should use getActiveActor from actor-session.ts in server components
	// or fetch from API in client components
}

const ActorContext = createContext<ActorContextValue | undefined>(undefined);

interface ActorProviderProps {
	children: ReactNode;
	session: Session | null;
}

export function ActorProvider({ children, session }: ActorProviderProps) {
	const value: ActorContextValue = {
		session,
		activeOrgId: session?.user?.activeOrgId,
	};

	return (
		<ActorContext.Provider value={value}>
			{children}
		</ActorContext.Provider>
	);
}

/**
 * Hook to access actor context
 * Returns session and activeOrgId
 * For full actor data, use getActiveActor in server components or fetch from API
 */
export function useActorContext() {
	const context = useContext(ActorContext);
	if (context === undefined) {
		throw new Error("useActorContext must be used within an ActorProvider");
	}
	return context;
}
