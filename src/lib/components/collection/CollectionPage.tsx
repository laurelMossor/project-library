import { FilterBoard } from "../filter-sort/FilterBoard";
import { FilteredCollection } from "./FilteredCollection";
import { PaginationControls } from "./PaginationControls";
import { CollectionItem } from "@/lib/types/collection";
import { FilterCollectionType, SortType, ViewType } from "@/lib/hooks/useFilter";
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
				<div className="text-center py-12">
					<p>
						{search
							? `No ${collectionTypeFilter === "all" ? "items" : collectionTypeFilter} found matching your search.`
							: `No ${collectionTypeFilter === "all" ? "collections" : collectionTypeFilter} yet. Be the first to create one!`}
					</p>
				</div>
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