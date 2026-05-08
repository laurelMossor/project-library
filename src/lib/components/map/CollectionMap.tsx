"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { LeafletMap } from "./LeafletMap";
import { EVENT_DETAIL } from "@/lib/const/routes";

type MapEvent = {
	id: string;
	title: string | null;
	latitude: number;
	longitude: number;
};

type CollectionMapProps = {
	events: MapEvent[];
	center?: { lat: number; lng: number };
	radiusMiles?: number;
	totalUnfiltered?: number;
};

// iOS Safari: aspect-ratio + max-height doesn't propagate to absolutely-positioned children.
// paddingBottom gives the parent a concrete computed height before Leaflet initializes.
const MAP_STYLE = { paddingBottom: "min(75%, 70vh)" } as const;

export function CollectionMap({ events, center, radiusMiles, totalUnfiltered }: CollectionMapProps) {
	const mapRef = useRef<any>(null);
	const leafletRef = useRef<any>(null);
	const markersRef = useRef<any[]>([]);
	const circleRef = useRef<any>(null);
	const [visibleCount, setVisibleCount] = useState(events.length);

	const updateVisibleCount = useCallback(() => {
		if (!mapRef.current) return;
		const bounds = mapRef.current.getBounds();
		let count = 0;
		for (const marker of markersRef.current) {
			if (bounds.contains(marker.getLatLng())) count++;
		}
		setVisibleCount(count);
	}, []);

	const handleMapReady = useCallback((map: any, L: any) => {
		mapRef.current = map;
		leafletRef.current = L;

		markersRef.current = events.map((event) => {
			const marker = L.marker([event.latitude, event.longitude]).addTo(map);
			const title = event.title || "Untitled Event";
			marker.bindPopup(
				`<a href="${EVENT_DETAIL(event.id)}" style="font-weight:600;color:var(--color-rich-brown)">${title}</a>`
			);
			return marker;
		});

		if (center && radiusMiles) {
			const radiusMeters = radiusMiles * 1609.34;
			circleRef.current = L.circle([center.lat, center.lng], {
				radius: radiusMeters,
				color: "#C4D6B0",
				fillColor: "#C4D6B0",
				fillOpacity: 0.1,
				weight: 2,
			}).addTo(map);
			map.fitBounds(circleRef.current.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length > 1) {
			const group = L.featureGroup(markersRef.current);
			map.fitBounds(group.getBounds(), { padding: [40, 40] });
		}

		map.on("moveend", updateVisibleCount);
		setTimeout(updateVisibleCount, 150);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!mapRef.current || !leafletRef.current) return;

		const L = leafletRef.current;
		const map = mapRef.current;

		for (const marker of markersRef.current) marker.remove();
		if (circleRef.current) {
			circleRef.current.remove();
			circleRef.current = null;
		}

		markersRef.current = events.map((event) => {
			const marker = L.marker([event.latitude, event.longitude]).addTo(map);
			const title = event.title || "Untitled Event";
			marker.bindPopup(
				`<a href="${EVENT_DETAIL(event.id)}" style="font-weight:600;color:var(--color-rich-brown)">${title}</a>`
			);
			return marker;
		});

		if (center && radiusMiles) {
			const radiusMeters = radiusMiles * 1609.34;
			circleRef.current = L.circle([center.lat, center.lng], {
				radius: radiusMeters,
				color: "#C4D6B0",
				fillColor: "#C4D6B0",
				fillOpacity: 0.1,
				weight: 2,
			}).addTo(map);
			map.fitBounds(circleRef.current.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length > 1) {
			const group = L.featureGroup(markersRef.current);
			map.fitBounds(group.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length === 1) {
			const pos = markersRef.current[0].getLatLng();
			map.setView([pos.lat, pos.lng], 13);
		}

		setTimeout(updateVisibleCount, 150);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [events, center?.lat, center?.lng, radiusMiles, updateVisibleCount]);

	const initialCenter = center ?? (events[0] ? { lat: events[0].latitude, lng: events[0].longitude } : { lat: 37.7749, lng: -122.4194 });

	const footerText = totalUnfiltered && totalUnfiltered !== events.length
		? `Showing ${visibleCount} of ${events.length} events within ${radiusMiles} mi`
		: `Showing ${visibleCount} ${visibleCount === 1 ? "event" : "events"} in view`;

	return (
		<LeafletMap
			center={[initialCenter.lat, initialCenter.lng]}
			zoom={13}
			style={MAP_STYLE}
			onMapReady={handleMapReady}
		>
			<div className="flex items-center justify-between text-xs text-dusty-grey px-1">
				<p>{footerText}</p>
				<p>&copy; OpenStreetMap contributors</p>
			</div>
		</LeafletMap>
	);
}
