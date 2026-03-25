"use client";

import { useBreakpoint } from "./useBreakpoint";

// Matches Tailwind's md and lg breakpoints
const MD_BREAKPOINT = 768;
const LG_BREAKPOINT = 1024;

function getColumnCount(): number {
	if (typeof window === "undefined") return 1;
	if (window.innerWidth >= LG_BREAKPOINT) return 3;
	if (window.innerWidth >= MD_BREAKPOINT) return 2;
	return 1;
}

/** Returns 1, 2, or 3 based on viewport width matching Tailwind md/lg breakpoints */
export function useColumnCount(): number {
	return useBreakpoint(getColumnCount);
}
