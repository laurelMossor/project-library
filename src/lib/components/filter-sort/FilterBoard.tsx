import { SortType, ViewType } from "@/lib/hooks/useFilter";
import { FilterCollectionType } from "@/lib/types/collection";
import { CollectionTypeFilters } from "./CollectionTypeFilters";
import { ViewToggle } from "./ViewToggle";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";

type FilterBoardProps = {
	title: string;
	collectionTypeFilter: FilterCollectionType;
	onCollectionTypeChange: (collectionType: FilterCollectionType) => void;
	sort: SortType;
	onSortChange: (sort: SortType) => void;
	view: ViewType;
	onViewChange: (view: ViewType) => void;
	hasLocationData?: boolean;
	selectedTags: string[];
	onTagsChange: (tags: string[]) => void;
	availableTags: string[];
};

export function FilterBoard({
	title: _title,
	collectionTypeFilter,
	onCollectionTypeChange,
	sort,
	onSortChange,
	view,
	onViewChange,
	hasLocationData = false,
	selectedTags,
	onTagsChange,
	availableTags: _availableTags,
}: FilterBoardProps) {

	return (
		<div className="mb-8">
			{/* Title and collection type filters */}
			<div className="flex items-center justify-end mb-4">
				<CollectionTypeFilters
					collectionTypeFilter={collectionTypeFilter}
					onCollectionTypeChange={onCollectionTypeChange}
				/>
			</div>

			{/* Sort and view toggle */}
			<div className="flex flex-wrap items-center gap-4 mb-4">
				{/* Sort dropdown */}
				<select
					value={sort}
					onChange={(e) => onSortChange(e.target.value as SortType)}
					className="border border-rich-brown bg-warm-grey p-2 text-grey-white rounded text-sm font-semibold"
				>
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
					<option value="relevance">Relevance</option>
				</select>

				{/* View toggle */}
				<ViewToggle
					view={view}
					onViewChange={onViewChange}
					hasLocationData={hasLocationData}
				/>
			</div>

			{/* Tag filter */}
			<div className="mb-4">
				<p className="text-xs font-semibold uppercase tracking-wider text-misty-forest mb-2">
					Explore by topic
				</p>
				<TagInputField
					tags={selectedTags}
					onTagsChange={onTagsChange}
					placeholder="Type and press Enter"
				/>
			</div>
		</div>
	);
}

