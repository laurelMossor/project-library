"use client";

import { useEffect, useRef, type ReactNode, type CSSProperties } from "react";
import { useLeaflet } from "@/lib/hooks/useLeaflet";

const WRAPPER_CLASSES = "relative isolate w-full rounded border border-soft-grey overflow-hidden";

type LeafletMapProps = {
	center: [number, number];
	zoom?: number;
	className?: string;
	style?: CSSProperties;
	onMapReady: (map: any, L: any) => void;
	children?: ReactNode;
};

export function LeafletMap({ center, zoom = 13, className, style, onMapReady, children }: LeafletMapProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const mapRef = useRef<any>(null);
	const onMapReadyRef = useRef(onMapReady);
	const { isLoading, mapError } = useLeaflet();

	useEffect(() => {
		onMapReadyRef.current = onMapReady;
	}, [onMapReady]);

	useEffect(() => {
		if (isLoading || !containerRef.current || mapRef.current) return;

		const L = (window as any).L;
		if (!L) return;

		const map = L.map(containerRef.current).setView(center, zoom);

		L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
			attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
			maxZoom: 19,
		}).addTo(map);

		mapRef.current = map;
		onMapReadyRef.current(map, L);

		setTimeout(() => mapRef.current?.invalidateSize(), 150);

		return () => {
			if (mapRef.current) {
				mapRef.current.remove();
				mapRef.current = null;
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isLoading]);

	if (mapError) {
		return (
			<div className={`${WRAPPER_CLASSES} bg-grey-white flex items-center justify-center ${className ?? ""}`} style={style}>
				<p className="text-sm text-dusty-grey">{mapError}</p>
			</div>
		);
	}

	if (isLoading) {
		return <div className={`${WRAPPER_CLASSES} bg-ash-green/30 animate-pulse ${className ?? ""}`} style={style} />;
	}

	return (
		<div className="w-full space-y-2">
			<div className={`${WRAPPER_CLASSES} ${className ?? ""}`} style={style}>
				<div ref={containerRef} className="absolute inset-0" />
			</div>
			{children}
		</div>
	);
}
