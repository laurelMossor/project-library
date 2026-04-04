"use client";

import { useEffect, useState } from "react";

/**
 * Loads the Leaflet library from CDN and returns loading state.
 * Idempotent: if Leaflet is already loaded on the page (e.g. by another map component),
 * it returns immediately without adding duplicate script/link tags.
 */
export function useLeaflet(): { isLoading: boolean; mapError: string | null } {
	const [isLoading, setIsLoading] = useState(true);
	const [mapError, setMapError] = useState<string | null>(null);

	useEffect(() => {
		if (typeof window === "undefined") return;

		// Already loaded — nothing to do
		if ((window as any).L) {
			setIsLoading(false);
			return;
		}

		// Load Leaflet CSS
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
		link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
		link.crossOrigin = "";
		document.head.appendChild(link);

		// Load Leaflet JS
		const script = document.createElement("script");
		script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
		script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
		script.crossOrigin = "";
		script.onload = () => setIsLoading(false);
		script.onerror = () => {
			setMapError("Failed to load map library");
			setIsLoading(false);
		};
		document.body.appendChild(script);

		return () => {
			// Only clean up if Leaflet wasn't already present when we started
			if (document.body.contains(script)) document.body.removeChild(script);
			if (document.head.contains(link)) document.head.removeChild(link);
		};
	}, []);

	return { isLoading, mapError };
}
