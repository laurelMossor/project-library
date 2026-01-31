import { FilterBoard } from "../filter-sort/FilterBoard";
import { FilteredCollection } from "./FilteredCollection";
import { PaginationControls } from "./PaginationControls";
import { EmptyState } from "./EmptyState";
import { CollectionItem, FilterCollectionType } from "@/lib/types/collection";
import { SortType, ViewType } from "@/lib/hooks/useFilter";
import { usePagination } from "@/lib/hooks/usePagination";
import { SearchBar } from "../search/SearchBar";

type CollectionPageProps = {
	filteredItems: CollectionItem[];
	loading: boolean;
	error: string;
	search: string;
	onSearchChange: (value: string) => void;
	collectionTypeFilter: FilterCollectionType;
	onCollectionTypeChange: (collectionType: FilterCollectionType) => void;
	sort: SortType;
	onSortChange: (sort: SortType) => void;
	view: ViewType;
	onViewChange: (view: ViewType) => void;
	hasLocationData: boolean;
	selectedTags: string[];
	onTagsChange: (tags: string[]) => void;
	availableTags: string[];
	title?: string;
	itemsPerPage?: number;
	showCreateLinks?: boolean;
};

export function CollectionPage({
	filteredItems,
	loading,
	error,
	search,
	onSearchChange,
	collectionTypeFilter,
	onCollectionTypeChange,
	sort,
	onSortChange,
	view,
	onViewChange,
	hasLocationData,
	selectedTags,
	onTagsChange,
	availableTags,
	title = "Collections",
	itemsPerPage = 12,
	showCreateLinks = true,
}: CollectionPageProps) {
	// Use pagination hook to slice items for current page
	const {
		paginatedItems,
		currentPage,
		totalPages,
		hasNextPage,
		hasPreviousPage,
		nextPage,
		previousPage,
	} = usePagination(filteredItems, itemsPerPage);

	return (
		<div className="max-w-6xl mx-auto w-full">
			<SearchBar searchValue={search} onSearchChange={onSearchChange} />

				<FilterBoard
					title={title}
					collectionTypeFilter={collectionTypeFilter}
					onCollectionTypeChange={onCollectionTypeChange}
					sort={sort}
					onSortChange={onSortChange}
					view={view}
					onViewChange={onViewChange}
					hasLocationData={hasLocationData}
					selectedTags={selectedTags}
					onTagsChange={onTagsChange}
					availableTags={availableTags}
				/>

			{/* Loading state */}
			{loading && (
				<div className="text-center py-12">
					<p>Loading collections...</p>
				</div>
			)}

			{/* Error state */}
			{error && (
				<div className="text-center py-12">
					<p className="text-red-500">{error}</p>
				</div>
			)}

			{/* Empty state */}
			{!loading && !error && filteredItems.length === 0 && (
				<EmptyState
					collectionTypeFilter={collectionTypeFilter}
					search={search}
					showCreateLinks={showCreateLinks}
				/>
			)}

			{/* Content display */}
			{!loading && !error && filteredItems.length > 0 && (
				<>
					<FilteredCollection items={paginatedItems} view={view} />
					<PaginationControls
						currentPage={currentPage}
						totalPages={totalPages}
						onPrevious={previousPage}
						onNext={nextPage}
					/>
				</>
			)}
		</div>
	);
}