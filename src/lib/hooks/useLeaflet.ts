"use client";

import { useEffect, useState } from "react";

let loaded = false;
let loading: Promise<void> | null = null;

function loadLeaflet(): Promise<void> {
	if (loaded) return Promise.resolve();
	if (loading) return loading;

	loading = new Promise<void>((resolve, reject) => {
		const link = document.createElement("link");
		link.rel = "stylesheet";
		link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
		link.integrity = "sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=";
		link.crossOrigin = "";

		const script = document.createElement("script");
		script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
		script.integrity = "sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=";
		script.crossOrigin = "";

		let cssReady = false;
		let jsReady = false;

		const checkDone = () => {
			if (cssReady && jsReady) {
				loaded = true;
				resolve();
			}
		};

		link.onload = () => { cssReady = true; checkDone(); };
		link.onerror = () => { loading = null; reject(new Error("Failed to load Leaflet CSS")); };

		script.onload = () => { jsReady = true; checkDone(); };
		script.onerror = () => { loading = null; reject(new Error("Failed to load Leaflet JS")); };

		document.head.appendChild(link);
		document.body.appendChild(script);
	});

	return loading;
}

export function useLeaflet(): { isLoading: boolean; mapError: string | null } {
	const [isLoading, setIsLoading] = useState(!loaded);
	const [mapError, setMapError] = useState<string | null>(null);

	useEffect(() => {
		if (loaded) { setIsLoading(false); return; }

		let cancelled = false;
		loadLeaflet()
			.then(() => { if (!cancelled) setIsLoading(false); })
			.catch((err) => {
				if (!cancelled) {
					setMapError(err.message);
					setIsLoading(false);
				}
			});

		return () => { cancelled = true; };
	}, []);

	return { isLoading, mapError };
}
