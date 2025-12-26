import { CollectionItem } from "@/lib/types/collection";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { CollectionItemCard } from "@/lib/components/collection/CollectionCard";

type FilteredCollectionProps = {
	items: CollectionItem[];
	view: "map" | "list" | "grid";
};

export function FilteredCollection({ items, view }: FilteredCollectionProps) {
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
	const containerClass = view === "list" 
		? "space-y-4" 
		: "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6";

	return (
		<div className={containerClass}>
			{items.map((item) => (
				<CollectionItemCard key={getCollectionItemKey(item)} item={item} truncate={truncate} />
			))}
		</div>
	);
}

