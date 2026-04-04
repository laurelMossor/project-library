"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { useLeaflet } from "@/lib/hooks/useLeaflet";
import { EVENT_DETAIL } from "@/lib/const/routes";

type MapEvent = {
	id: string;
	title: string | null;
	latitude: number;
	longitude: number;
};

type CollectionMapProps = {
	events: MapEvent[];
};

/**
 * Read-only multi-marker Leaflet map for the collection map view.
 * Each marker links to its event detail page. Centers/fits to all markers.
 * Uses the shared useLeaflet hook for CDN loading.
 */
export function CollectionMap({ events }: CollectionMapProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const { isLoading, mapError } = useLeaflet();

	useEffect(() => {
		if (isLoading || !mapContainerRef.current || !(window as any).L || mapRef.current) return;
		if (events.length === 0) return;

		const L = (window as any).L;

		// Center on first event initially; fitBounds will adjust for multiple
		const firstEvent = events[0];
		mapRef.current = L.map(mapContainerRef.current).setView(
			[firstEvent.latitude, firstEvent.longitude],
			13
		);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(mapRef.current);

		const markers: any[] = events.map((event) => {
			const marker = L.marker([event.latitude, event.longitude]).addTo(mapRef.current);
			const title = event.title || "Untitled Event";
			// Link uses absolute path — safe because EVENT_DETAIL returns a path string
			marker.bindPopup(`<a href="${EVENT_DETAIL(event.id)}" style="font-weight:600;color:#5a3a1a">${title}</a>`);
			return marker;
		});

		// Fit bounds to all markers when there are multiple events
		if (markers.length > 1) {
			const group = L.featureGroup(markers);
			mapRef.current.fitBounds(group.getBounds(), { padding: [40, 40] });
		}

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading]); // Re-run only when Leaflet finishes loading; events are fixed at mount

	if (mapError) {
		return (
			<div className="w-full h-96 rounded border border-gray-200 bg-gray-50 flex items-center justify-center">
				<p className="text-sm text-gray-600">{mapError}</p>
			</div>
		);
	}

	if (isLoading) {
		return <div className="w-full h-96 rounded border border-gray-200 bg-gray-100 animate-pulse" />;
	}

	return (
		<div className="w-full space-y-2">
			<div ref={mapContainerRef} className="w-full h-96 rounded border border-gray-200" />
			<div className="flex items-center justify-between text-xs text-gray-500 px-1">
				<p>Map powered by OpenStreetMap. Showing {events.length} {events.length === 1 ? "event" : "events"} with location.</p>
				<Link
					href="https://www.openstreetmap.org"
					target="_blank"
					rel="noreferrer"
					className="text-blue-600 underline underline-offset-2"
				>
					Open OpenStreetMap
				</Link>
			</div>
		</div>
	);
}
