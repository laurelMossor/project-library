"use client";

import { useEffect, useRef, useState } from "react";
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
	center?: { lat: number; lng: number };
	radiusMiles?: number;
	totalUnfiltered?: number;
};

// aspect-ratio + max-height on the parent doesn't propagate a computed height to absolutely-positioned
// children on iOS Safari — Leaflet reads clientHeight=0 and never renders tiles. The padding-bottom
// technique gives the parent a concrete computed height before Leaflet initializes.
// padding-bottom percentages are always relative to containing block width, so min(75%, 70vh)
// produces a 4:3-equivalent height capped at 70vh on any screen size.
const WRAPPER_CLASSES = "relative w-full rounded border border-soft-grey overflow-hidden";
const WRAPPER_STYLE = { paddingBottom: "min(75%, 70vh)" } as const;

export function CollectionMap({ events, center, radiusMiles, totalUnfiltered }: CollectionMapProps) {
	const mapContainerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const markersRef = useRef<any[]>([]);
	const circleRef = useRef<any>(null);
	const [visibleCount, setVisibleCount] = useState(events.length);
	const { isLoading, mapError } = useLeaflet();

	const updateVisibleCount = () => {
		if (!mapRef.current) return;
		const bounds = mapRef.current.getBounds();
		let count = 0;
		for (const marker of markersRef.current) {
			if (bounds.contains(marker.getLatLng())) count++;
		}
		setVisibleCount(count);
	};

	useEffect(() => {
		if (isLoading || !mapContainerRef.current || !(window as any).L || mapRef.current) return;
		if (events.length === 0) return;

		const L = (window as any).L;

		const initialCenter = center ?? { lat: events[0].latitude, lng: events[0].longitude };
		mapRef.current = L.map(mapContainerRef.current).setView(
			[initialCenter.lat, initialCenter.lng],
			13
		);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(mapRef.current);

		markersRef.current = events.map((event) => {
			const marker = L.marker([event.latitude, event.longitude]).addTo(mapRef.current);
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
			}).addTo(mapRef.current);
			mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length > 1) {
			const group = L.featureGroup(markersRef.current);
			mapRef.current.fitBounds(group.getBounds(), { padding: [40, 40] });
		}

		mapRef.current.on("moveend", updateVisibleCount);

		// Force Leaflet to recalculate size after layout — critical on iOS Safari
		setTimeout(() => {
			mapRef.current?.invalidateSize();
			updateVisibleCount();
		}, 150);

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
				markersRef.current = [];
				circleRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading]);

	// Update markers and circle when events, center, or radius change
	useEffect(() => {
		if (isLoading || !mapRef.current) return;

		const L = (window as any).L;
		if (!L) return;

		for (const marker of markersRef.current) {
			marker.remove();
		}
		if (circleRef.current) {
			circleRef.current.remove();
			circleRef.current = null;
		}

		markersRef.current = events.map((event) => {
			const marker = L.marker([event.latitude, event.longitude]).addTo(mapRef.current);
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
			}).addTo(mapRef.current);
			mapRef.current.fitBounds(circleRef.current.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length > 1) {
			const group = L.featureGroup(markersRef.current);
			mapRef.current.fitBounds(group.getBounds(), { padding: [40, 40] });
		} else if (markersRef.current.length === 1) {
			const pos = markersRef.current[0].getLatLng();
			mapRef.current.setView([pos.lat, pos.lng], 13);
		}

		setTimeout(updateVisibleCount, 150);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [events, center?.lat, center?.lng, radiusMiles]);

	if (mapError) {
		return (
			<div className={`${WRAPPER_CLASSES} bg-grey-white flex items-center justify-center`} style={WRAPPER_STYLE}>
				<p className="text-sm text-dusty-grey">{mapError}</p>
			</div>
		);
	}

	if (isLoading) {
		return <div className={`${WRAPPER_CLASSES} bg-ash-green/30 animate-pulse`} style={WRAPPER_STYLE} />;
	}

	const footerText = totalUnfiltered && totalUnfiltered !== events.length
		? `Showing ${visibleCount} of ${events.length} events within ${radiusMiles} mi`
		: `Showing ${visibleCount} ${visibleCount === 1 ? "event" : "events"} in view`;

	return (
		<div className="w-full space-y-2">
			<div className={WRAPPER_CLASSES} style={WRAPPER_STYLE}>
				<div ref={mapContainerRef} className="absolute inset-0" />
			</div>
			<div className="flex items-center justify-between text-xs text-dusty-grey px-1">
				<p>{footerText}</p>
				<p>&copy; OpenStreetMap contributors</p>
			</div>
		</div>
	);
}
