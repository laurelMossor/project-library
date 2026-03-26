"use client";

import { useBreakpoint } from "./useBreakpoint";

export type DeviceType = "mobile" | "desktop";
export const SMALL_SCREEN_WIDTH = 600;

function getSmallScreen(): boolean {
	if (typeof window === "undefined") return false;

	if (window.innerWidth < SMALL_SCREEN_WIDTH) return true;

	const userAgent = navigator.userAgent.toLowerCase();
	return /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
}

/**
 * Hook to detect if the user is on a small screen or mobile device.
 * Uses window width (600px breakpoint) with user agent fallback.
 */
export function useSmallScreen(): boolean {
	return useBreakpoint(getSmallScreen, false);
}

/**
 * Simple boolean hook to check if device is mobile
 */
export function useIsMobile(): boolean {
	return useSmallScreen();
}
