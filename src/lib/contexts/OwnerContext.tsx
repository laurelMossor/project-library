"use client";

import { createContext, useContext, ReactNode } from "react";
import { Session } from "next-auth";

interface SessionContextValue {
  session: Session | null;
  activePageId: string | undefined;
}

const SessionCtx = createContext<SessionContextValue | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
  session: Session | null;
}

export function SessionProvider({ children, session }: SessionProviderProps) {
  const value: SessionContextValue = {
    session,
    activePageId: session?.user?.activePageId,
  };

  return (
    <SessionCtx.Provider value={value}>
      {children}
    </SessionCtx.Provider>
  );
}

export function useSessionContext() {
  const context = useContext(SessionCtx);
  if (context === undefined) {
    throw new Error("useSessionContext must be used within a SessionProvider");
  }
  return context;
}
