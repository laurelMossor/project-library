"use client";

import { useEffect, useRef, useState } from "react";

type InteractiveMapProps = {
	latitude: number | null;
	longitude: number | null;
	onLocationChange: (lat: number, lng: number) => void;
	onAddressGeocode?: (address: string) => void;
};

/**
 * Interactive map component using Leaflet (loaded from CDN).
 * Allows dragging a marker to set location coordinates.
 */
export function InteractiveMap({
	latitude,
	longitude,
	onLocationChange,
	onAddressGeocode,
}: InteractiveMapProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const markerRef = useRef<any>(null);
	const onLocationChangeRef = useRef(onLocationChange);
	const [isLoading, setIsLoading] = useState(true);
	const [mapError, setMapError] = useState<string | null>(null);

	// Keep callback ref up to date without triggering re-renders
	useEffect(() => {
		onLocationChangeRef.current = onLocationChange;
	}, [onLocationChange]);

	// Load Leaflet from CDN
	useEffect(() => {
		if (typeof window === "undefined") return;

		// Check if Leaflet is already loaded
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
		script.onload = () => {
			setIsLoading(false);
		};
		script.onerror = () => {
			setMapError("Failed to load map library");
			setIsLoading(false);
		};
		document.body.appendChild(script);

		return () => {
			// Cleanup: remove script and link on unmount
			document.body.removeChild(script);
			document.head.removeChild(link);
		};
	}, []);

	// Initialize map once Leaflet is loaded (only runs once)
	useEffect(() => {
		if (isLoading || !mapContainerRef.current || !(window as any).L || mapRef.current) return;

		const L = (window as any).L;

		// Initialize map centered on provided coordinates or default location
		const initialLat = latitude ?? 37.7749; // San Francisco default
		const initialLng = longitude ?? -122.4194;

		mapRef.current = L.map(mapContainerRef.current).setView([initialLat, initialLng], 13);

		// Add OpenStreetMap tiles
		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(mapRef.current);

		// Create draggable marker
		const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(mapRef.current);

		// Update coordinates when marker is dragged
		marker.on("dragend", () => {
			const position = marker.getLatLng();
			onLocationChangeRef.current(position.lat, position.lng);
		});

		// Allow clicking on map to move marker
		mapRef.current.on("click", (e: any) => {
			marker.setLatLng(e.latlng);
			onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
		});

		markerRef.current = marker;

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				markerRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading]); // Only depend on isLoading - coordinates handled by separate effect

	// Update marker position when coordinates change externally (separate effect)
	useEffect(() => {
		if (!mapRef.current || !markerRef.current) return;

		// Only update if coordinates are provided and different from current position
		if (latitude !== null && longitude !== null) {
			const currentPos = markerRef.current.getLatLng();
			const newLat = latitude;
			const newLng = longitude;

			// Only update if position actually changed (avoid unnecessary updates)
			if (Math.abs(currentPos.lat - newLat) > 0.0001 || Math.abs(currentPos.lng - newLng) > 0.0001) {
				markerRef.current.setLatLng([newLat, newLng]);
				mapRef.current.setView([newLat, newLng], mapRef.current.getZoom());
			}
		}
	}, [latitude, longitude]);

	if (mapError) {
		return (
			<div className="w-full h-64 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
				<p className="text-sm text-gray-600">{mapError}</p>
			</div>
		);
	}

	return (
		<div className="w-full space-y-2">
			<div ref={mapContainerRef} className="w-full h-64 rounded border border-gray-200" />
			<p className="text-xs text-gray-500">
				Click on the map or drag the marker to set the event location. Coordinates will update automatically.
			</p>
		</div>
	);
}

/**
 * Geocode an address to coordinates using OpenStreetMap Nominatim API
 */
export async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
	try {
		const encodedAddress = encodeURIComponent(address);
		const response = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodedAddress}&format=json&limit=1`,
			{
				headers: {
					"User-Agent": "ProjectLibrary/1.0", // Required by Nominatim
				},
			}
		);

		if (!response.ok) {
			return null;
		}

		const data = await response.json();
		if (data && data.length > 0) {
			return {
				lat: parseFloat(data[0].lat),
				lng: parseFloat(data[0].lon),
			};
		}

		return null;
	} catch (error) {
		console.error("Geocoding error:", error);
		return null;
	}
}

