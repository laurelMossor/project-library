// Type declarations for Leaflet loaded from CDN
declare namespace L {
	interface Map {
		setView(center: [number, number], zoom: number): Map;
		getZoom(): number;
		on(event: string, handler: (e: any) => void): Map;
		remove(): void;
	}

	interface Marker {
		setLatLng(latlng: [number, number]): Marker;
		getLatLng(): LatLng;
		on(event: string, handler: () => void): Marker;
		addTo(map: Map): Marker;
	}

	interface LatLng {
		lat: number;
		lng: number;
	}

	interface LeafletMouseEvent {
		latlng: LatLng;
	}

	interface TileLayer {
		addTo(map: Map): TileLayer;
	}

	interface MapStatic {
		map(container: HTMLElement): Map;
		tileLayer(urlTemplate: string, options?: any): TileLayer;
		marker(latlng: [number, number], options?: { draggable?: boolean }): Marker;
	}

	const map: MapStatic["map"];
	const tileLayer: MapStatic["tileLayer"];
	const marker: MapStatic["marker"];
}

declare interface Window {
	L: typeof L;
}

