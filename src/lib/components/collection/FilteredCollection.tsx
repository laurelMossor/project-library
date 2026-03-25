import { useMemo } from "react";
import { CollectionItem } from "@/lib/types/collection";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { useColumnCount } from "@/lib/hooks/useColumnCount";

type FilteredCollectionProps = {
	items: CollectionItem[];
	view: "map" | "list" | "grid";
};

export function FilteredCollection({ items, view }: FilteredCollectionProps) {
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
		return (
			<div className="text-center py-12">
				<p className="text-gray-600 mb-4">Map view coming soon</p>
				<p className="text-sm text-gray-500">
					{items.length} {items.length === 1 ? "item" : "items"} found
				</p>
			</div>
		);
	}

	const truncate = view === "grid";

	if (view === "list") {
		return (
			<div className="space-y-4">
				{items.map((item) => (
					<CollectionCard key={getCollectionItemKey(item)} item={item} truncate={truncate} />
				))}
			</div>
		);
	}

	return (
		<div className="flex gap-6">
			{columns.map((col, colIndex) => (
				<div key={colIndex} className="flex-1 min-w-0 space-y-6">
					{col.map((item) => (
						<CollectionCard key={getCollectionItemKey(item)} item={item} truncate={truncate} />
					))}
				</div>
			))}
		</div>
	);
}
