import { useMemo } from "react";
import dynamic from "next/dynamic";
import { CollectionItem, isEvent } from "@/lib/types/collection";
import { EventItem } from "@/lib/types/event";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { CollectionCard, PinConfig } from "@/lib/components/collection/CollectionCard";
import { useColumnCount } from "@/lib/hooks/useColumnCount";

// Leaflet requires browser APIs — load without SSR
const CollectionMap = dynamic(
	() => import("@/lib/components/map/CollectionMap").then((m) => m.CollectionMap),
	{ ssr: false, loading: () => <div className="w-full h-96 bg-gray-100 animate-pulse rounded border border-gray-200" /> }
);

type FilteredCollectionProps = {
	items: CollectionItem[];
	view: "map" | "list" | "grid";
	pinConfig?: PinConfig;
};

export function FilteredCollection({ items, view, pinConfig }: FilteredCollectionProps) {
	const columnCount = useColumnCount();

	// Distribute items across columns using modulo
	const columns = useMemo(() => {
		const cols: CollectionItem[][] = Array.from({ length: columnCount }, () => []);
		items.forEach((item, i) => {
			cols[i % columnCount].push(item);
		});
		return cols;
	}, [items, columnCount]);

	if (items.length === 0) {
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
					<p className="text-gray-600">No events with location data to display on the map.</p>
				</div>
			);
		}

		return (
			<CollectionMap
				events={eventsWithLocation.map((e) => ({
					id: e.id,
					title: e.title,
					latitude: e.latitude,
					longitude: e.longitude,
				}))}
			/>
		);
	}

	const truncate = view === "grid";

	if (view === "list") {
		return (
			<div className="space-y-4">
				{items.map((item) => (
					<CollectionCard key={getCollectionItemKey(item)} item={item} truncate={truncate} pinConfig={pinConfig} />
				))}
			</div>
		);
	}

	return (
		<div className="flex gap-6">
			{columns.map((col, colIndex) => (
				<div key={colIndex} className="flex-1 min-w-0 space-y-6">
					{col.map((item) => (
						<CollectionCard key={getCollectionItemKey(item)} item={item} truncate={truncate} pinConfig={pinConfig} />
					))}
				</div>
			))}
		</div>
	);
}
