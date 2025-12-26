import { FilterBoard } from "./FilterBoard";
import { FilteredCollection } from "./FilteredCollection";
import { CollectionItem } from "@/lib/types/collection";
import { FilterType, SortType, ViewType } from "@/lib/hooks/useFilter";

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
	title?: string;
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
	title = "Collections",
}: CollectionPageProps) {
	return (
		<div className="max-w-6xl mx-auto w-full">
			{/* Header */}
			<div className="mb-8">
				<h1 className="text-3xl font-bold mb-4">{title}</h1>

				<FilterBoard
					search={search}
					onSearchChange={onSearchChange}
					filter={filter}
					onFilterChange={onFilterChange}
					sort={sort}
					onSortChange={onSortChange}
					view={view}
					onViewChange={onViewChange}
					hasLocationData={hasLocationData}
				/>
			</div>

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
				<FilteredCollection items={filteredItems} view={view} />
			)}
		</div>
	);
}