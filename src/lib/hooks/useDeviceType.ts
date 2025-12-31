"use client";

import { useState, useEffect } from "react";

export type DeviceType = "mobile" | "desktop";
export const SMALL_SCREEN_WIDTH = 600;

/**
 * Hook to detect if the user is on mobile or desktop
 * Uses window width (768px breakpoint) as the primary detection method
 * Falls back to user agent if window is not available (SSR)
 */
export function useSmallScreen(): boolean {
	const [smallScreen, setSmallScreen] = useState<boolean>(() => {
        let smallScreenWidth = false
		// Default to desktop for SSR
		if (typeof window === "undefined") {
			return false;
		}
		
		// Check window width first (most reliable)
		if (window.innerWidth < SMALL_SCREEN_WIDTH) {
			smallScreenWidth = true;
		}
		
		// Fallback to user agent check
		const userAgent = navigator.userAgent.toLowerCase();
		const isMobile = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
		return isMobile || smallScreenWidth;
	});

	useEffect(() => {
		const setDeviceTypeBasedOnWindowWidth = () => {
			if (window.innerWidth < SMALL_SCREEN_WIDTH) {
				setSmallScreen(true);
			} else {
				setSmallScreen(false);
			}
		};

		// Set initial value
		setDeviceTypeBasedOnWindowWidth();

		// Listen for resize events
		window.addEventListener("resize", setDeviceTypeBasedOnWindowWidth);

		return () => {
			window.removeEventListener("resize", setDeviceTypeBasedOnWindowWidth);
		};
	}, []);

	return smallScreen;
}

/**
 * Simple boolean hook to check if device is mobile
 */
export function useIsMobile(): boolean {
	const smallScreen = useSmallScreen();
	return smallScreen;
}

