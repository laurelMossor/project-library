import { useState } from "react";
import { FilterCollectionType, SortType, ViewType } from "@/lib/hooks/useFilter";
import { CollectionTitle } from "../collection/CollectionTitle";
import { CollectionTypeFilters } from "./CollectionTypeFilters";

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
	title,
	collectionTypeFilter,
	onCollectionTypeChange,
	sort,
	onSortChange,
	view,
	onViewChange,
	hasLocationData = false,
	selectedTags,
	onTagsChange,
	availableTags,
}: FilterBoardProps) {
	const [tagInput, setTagInput] = useState("");

	const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" && tagInput.trim()) {
			e.preventDefault();
			const tag = tagInput.trim();
			// Only add if not already selected
			if (!selectedTags.includes(tag)) {
				onTagsChange([...selectedTags, tag]);
			}
			setTagInput("");
		}
	};

	const handleRemoveTag = (tagToRemove: string) => {
		onTagsChange(selectedTags.filter((t) => t !== tagToRemove));
	};

	return (
		<div className="mb-8">
			{/* Title and collection type filters */}
			<div className="flex items-center justify-between mb-4">
				<CollectionTitle title={title} />
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
					className="border p-2 rounded text-sm"
				>
					<option value="newest">Newest First</option>
					<option value="oldest">Oldest First</option>
					<option value="relevance">Relevance</option>
				</select>

				{/* View toggle */}
				<div className="flex gap-2 ml-auto">
					<button
						onClick={() => onViewChange("grid")}
						className={`px-3 py-1 text-sm border rounded transition ${
							view === "grid" ? "bg-black text-white" : "bg-white"
						}`}
					>
						Grid
					</button>
					<button
						onClick={() => onViewChange("list")}
						className={`px-3 py-1 text-sm border rounded transition ${
							view === "list" ? "bg-black text-white" : "bg-white"
						}`}
					>
						List
					</button>
					{hasLocationData && (
						<button
							onClick={() => onViewChange("map")}
							className={`px-3 py-1 text-sm border rounded transition ${
								view === "map" ? "bg-black text-white" : "bg-white"
							}`}
						>
							Map
						</button>
					)}
				</div>
			</div>

			{/* Tag filter */}
			<div className="mb-4">
				<div className="flex flex-wrap items-center gap-2 mb-2">
					<label htmlFor="tag-filter" className="text-sm font-medium text-gray-700">
						Filter by Tags:
					</label>
					<input
						id="tag-filter"
						type="text"
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
						onKeyDown={handleTagInputKeyDown}
						placeholder="Type a tag and press Enter"
						className="border p-2 rounded text-sm flex-1 max-w-xs"
					/>
				</div>
				{selectedTags.length > 0 && (
					<div className="flex flex-wrap gap-2 items-center">
						{selectedTags.map((tag) => (
							<button
								key={tag}
								onClick={() => handleRemoveTag(tag)}
								className="flex items-center gap-1 px-3 py-1 border bg-melon-green border-soft-grey rounded text-xs hover:bg-opacity-80 transition"
								title="Click to remove"
							>
								<span>{tag}</span>
								<span className="text-gray-600 hover:text-black">×</span>
							</button>
						))}
						<button
							onClick={() => onTagsChange([])}
							className="px-3 py-1 text-sm text-gray-600 underline hover:text-black"
						>
							Clear all
						</button>
					</div>
				)}
			</div>
		</div>
	);
}

