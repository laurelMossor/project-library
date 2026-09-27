"use client";

import { useBreakpoint } from "./useBreakpoint";

/** True below Tailwind's `sm` breakpoint (640px). matchMedia is more reliable than innerWidth on mobile Safari. */
export function useIsMobile(): boolean {
	return useBreakpoint(() => window.matchMedia("(max-width: 639px)").matches, false);
}
