"use client";

import { createContext, useContext, ReactNode } from "react";
import { Session } from "next-auth";

/**
 * OwnerContext provides the active owner context based on session
 * This allows components to easily access the current owner without prop drilling
 */

interface OwnerContextValue {
	session: Session | null;
	activeOwnerId: string | undefined;
	// Note: getActiveOwner is async and requires DB access, so it's not included here
	// Components should use getActiveOwner from owner-session.ts in server components
	// or fetch from API in client components
}

const OwnerContext = createContext<OwnerContextValue | undefined>(undefined);

interface OwnerProviderProps {
	children: ReactNode;
	session: Session | null;
}

export function OwnerProvider({ children, session }: OwnerProviderProps) {
	const value: OwnerContextValue = {
		session,
		activeOwnerId: session?.user?.activeOwnerId,
	};

	return (
		<OwnerContext.Provider value={value}>
			{children}
		</OwnerContext.Provider>
	);
}

/**
 * Hook to access owner context
 * Returns session and activeOwnerId
 * For full owner data, use getActiveOwner in server components or fetch from API
 */
export function useOwnerContext() {
	const context = useContext(OwnerContext);
	if (context === undefined) {
		throw new Error("useOwnerContext must be used within an OwnerProvider");
	}
	return context;
}
