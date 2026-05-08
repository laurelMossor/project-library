"use client";

import { useEffect, useRef, useCallback } from "react";
import { LeafletMap } from "./LeafletMap";

type InteractiveMapProps = {
	latitude: number | null;
	longitude: number | null;
	onLocationChange: (lat: number, lng: number) => void;
};

export function InteractiveMap({ latitude, longitude, onLocationChange }: InteractiveMapProps) {
	const mapRef = useRef<any>(null);
	const markerRef = useRef<any>(null);
	const onLocationChangeRef = useRef(onLocationChange);

	useEffect(() => {
		onLocationChangeRef.current = onLocationChange;
	}, [onLocationChange]);

	const handleMapReady = useCallback((map: any, L: any) => {
		mapRef.current = map;

		const initialLat = latitude ?? 37.7749;
		const initialLng = longitude ?? -122.4194;

		const marker = L.marker([initialLat, initialLng], { draggable: true }).addTo(map);

		marker.on("dragend", () => {
			const position = marker.getLatLng();
			onLocationChangeRef.current(position.lat, position.lng);
		});

		map.on("click", (e: any) => {
			marker.setLatLng(e.latlng);
			onLocationChangeRef.current(e.latlng.lat, e.latlng.lng);
		});

		markerRef.current = marker;
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	useEffect(() => {
		if (!mapRef.current || !markerRef.current) return;
		if (latitude !== null && longitude !== null) {
			const currentPos = markerRef.current.getLatLng();
			if (Math.abs(currentPos.lat - latitude) > 0.0001 || Math.abs(currentPos.lng - longitude) > 0.0001) {
				markerRef.current.setLatLng([latitude, longitude]);
				mapRef.current.setView([latitude, longitude], mapRef.current.getZoom());
			}
		}
	}, [latitude, longitude]);

	return (
		<LeafletMap
			center={[latitude ?? 37.7749, longitude ?? -122.4194]}
			zoom={13}
			className="h-64"
			onMapReady={handleMapReady}
		>
			<p className="text-xs text-dusty-grey">
				Click on the map or drag the marker to set the event location.
			</p>
		</LeafletMap>
	);
}
