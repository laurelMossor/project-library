import { FilterCollectionType } from "@/lib/hooks/useFilter";
import { COLLECTION_TYPES } from "@/lib/types/collection";
import { CollectionTypeButton } from "../tag/CollectionTypeBadge";

type CollectionTypeFiltersProps = {
	collectionTypeFilter: FilterCollectionType;
	onCollectionTypeChange: (collectionType: FilterCollectionType) => void;
};

export function CollectionTypeFilters({
	collectionTypeFilter,
	onCollectionTypeChange,
}: CollectionTypeFiltersProps) {
	const FILTER_ALL = "all" as const;
	return (
		<div className="flex gap-2">
			<CollectionTypeButton
				label="All"
				value={FILTER_ALL}
				selected={collectionTypeFilter === FILTER_ALL}
				onClick={onCollectionTypeChange}
			/>
			<CollectionTypeButton
				label="Projects"
				value={COLLECTION_TYPES.PROJECT}
				selected={collectionTypeFilter === FILTER_ALL || collectionTypeFilter === COLLECTION_TYPES.PROJECT}
				onClick={onCollectionTypeChange}
			/>
			<CollectionTypeButton
				label="Events"
				value={COLLECTION_TYPES.EVENT}
				selected={collectionTypeFilter === FILTER_ALL || collectionTypeFilter === COLLECTION_TYPES.EVENT}
				onClick={onCollectionTypeChange}
			/>
		</div>
	);
}
