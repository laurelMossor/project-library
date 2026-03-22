import { CollectionItem } from "@/lib/types/collection";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";

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
		<div className="columns-1 md:columns-2 lg:columns-3 gap-6">
			{items.map((item) => (
				<div key={getCollectionItemKey(item)} className="break-inside-avoid mb-6">
					<CollectionCard item={item} truncate={truncate} />
				</div>
			))}
		</div>
	);
}

