import { useState } from "react";
import { SortType, ViewType } from "@/lib/hooks/useFilter";
import { FilterCollectionType } from "@/lib/types/collection";
import { CollectionTitle } from "../collection/CollectionTitle";
import { CollectionTypeFilters } from "./CollectionTypeFilters";
import { ViewToggle } from "./ViewToggle";

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
		if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
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
				<div className="flex flex-wrap items-center gap-2 mb-2">
					<label htmlFor="tag-filter" className="text-sm font-medium text-gray-700">
						What interests you?
					</label>
					<input
						id="tag-filter"
						type="text"
						value={tagInput}
						onChange={(e) => setTagInput(e.target.value)}
						onKeyDown={handleTagInputKeyDown}
						placeholder="Enter a keyword, tag, or topic"
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

