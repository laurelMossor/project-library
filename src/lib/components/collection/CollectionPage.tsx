import { FilterBoard } from "../filter-sort/FilterBoard";
import { FilteredCollection } from "./FilteredCollection";
import { PaginationControls } from "./PaginationControls";
import { CollectionItem } from "@/lib/types/collection";
import { FilterType, SortType, ViewType } from "@/lib/hooks/useFilter";
import { usePagination } from "@/lib/hooks/usePagination";
import { BetaTag } from "../tag/betaTag";
import { SearchBar } from "../search/SearchBar";

type CollectionPageProps = {
	filteredItems: CollectionItem[];
	loading: boolean;
	error: string;
	search: string;
	onSearchChange: (value: string) => void;
	filter: FilterType;
	onFilterChange: (filter: FilterType) => void;
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
	filter,
	onFilterChange,
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

				<div className="flex gap-2">
					<h1 className="text-3xl font-bold mb-4">{title}</h1>
					<BetaTag />
				</div>

				<FilterBoard
					search={search}
					filter={filter}
					onFilterChange={onFilterChange}
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
							? `No ${filter === "all" ? "items" : filter} found matching your search.`
							: `No ${filter === "all" ? "collections" : filter} yet. Be the first to create one!`}
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