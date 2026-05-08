import { useMemo, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { CollectionItem, AnyCollectionItem, AboutCollectionItem, isEvent } from "@/lib/types/collection";
import { EventItem } from "@/lib/types/event";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { CollectionCard, PinConfig } from "@/lib/components/collection/CollectionCard";
import { useColumnCount } from "@/lib/hooks/useColumnCount";
import { MapControls } from "@/lib/components/map/MapControls";
import type { LocationResult } from "@/lib/components/map/LocationSearchInput";

// Leaflet requires browser APIs — load without SSR
const CollectionMap = dynamic(
	() => import("@/lib/components/map/CollectionMap").then((m) => m.CollectionMap),
	{
		ssr: false,
		loading: () => (
			<div
				className="relative w-full rounded border border-soft-grey overflow-hidden bg-ash-green/30 animate-pulse"
				style={{ paddingBottom: "min(75%, 70vh)" }}
			/>
		),
	}
);

type FilteredCollectionProps = {
	items: CollectionItem[];
	/** Fixed cards prepended before the sortable/filterable items (e.g. About card). */
	prependItems?: AboutCollectionItem[];
	view: "map" | "list" | "grid";
	pinConfig?: PinConfig;
};

const itemKey = (item: AnyCollectionItem): string =>
	item.type === "about" ? `about-${item.handle}` : getCollectionItemKey(item as CollectionItem);

function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
	const R = 3959;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLng = ((lng2 - lng1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function FilteredCollection({ items, prependItems = [], view, pinConfig }: FilteredCollectionProps) {
	const columnCount = useColumnCount();

	// Map filter state
	const [centerLocation, setCenterLocation] = useState<{ lat: number; lng: number; label: string } | null>(null);
	const [radiusMiles, setRadiusMiles] = useState(10);

	const handleLocationSelect = useCallback((result: LocationResult) => {
		setCenterLocation({ lat: result.lat, lng: result.lng, label: result.displayName });
	}, []);

	const handleClear = useCallback(() => {
		setCenterLocation(null);
	}, []);

	const allItems: AnyCollectionItem[] = [...prependItems, ...items];

	// Distribute items across columns using modulo
	const columns = useMemo(() => {
		const cols: AnyCollectionItem[][] = Array.from({ length: columnCount }, () => []);
		allItems.forEach((item, i) => {
			cols[i % columnCount].push(item);
		});
		return cols;
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [items, prependItems, columnCount]);

	if (allItems.length === 0) {
		return null;
	}

	if (view === "map") {
		const eventsWithLocation = items
			.filter(isEvent)
			.filter((e): e is EventItem & { latitude: number; longitude: number } =>
				e.latitude !== null && e.longitude !== null
			);

		if (eventsWithLocation.length === 0) {
			return (
				<div className="text-center py-12">
					<p className="text-dusty-grey">No events with location data to display on the map.</p>
				</div>
			);
		}

		// Apply radius filter if a center location is set
		const filteredEvents = centerLocation
			? eventsWithLocation.filter(
					(e) => haversineDistance(centerLocation.lat, centerLocation.lng, e.latitude, e.longitude) <= radiusMiles
				)
			: eventsWithLocation;

		const mapEvents = filteredEvents.map((e) => ({
			id: e.id,
			title: e.title,
			latitude: e.latitude,
			longitude: e.longitude,
		}));

		return (
			<div className="space-y-0">
				<MapControls
					locationLabel={centerLocation?.label ?? ""}
					radiusMiles={radiusMiles}
					onLocationSelect={handleLocationSelect}
					onRadiusChange={setRadiusMiles}
					onClear={handleClear}
					hasActiveFilter={centerLocation !== null}
				/>
				{filteredEvents.length === 0 ? (
					<div className="text-center py-12">
						<p className="text-dusty-grey">
							No events found within {radiusMiles} mi of {centerLocation?.label}.
						</p>
					</div>
				) : (
					<CollectionMap
						events={mapEvents}
						center={centerLocation ?? undefined}
						radiusMiles={centerLocation ? radiusMiles : undefined}
						totalUnfiltered={eventsWithLocation.length}
					/>
				)}
			</div>
		);
	}

	const truncate = view === "grid";

	if (view === "list") {
		return (
			<div className="space-y-4">
				{allItems.map((item) => (
					<CollectionCard key={itemKey(item)} item={item} truncate={truncate} pinConfig={pinConfig} />
				))}
			</div>
		);
	}

	return (
		<div className="flex gap-6">
			{columns.map((col, colIndex) => (
				<div key={colIndex} className="flex-1 min-w-0 space-y-6">
					{col.map((item) => (
						<CollectionCard key={itemKey(item)} item={item} truncate={truncate} pinConfig={pinConfig} />
					))}
				</div>
			))}
		</div>
	);
}
