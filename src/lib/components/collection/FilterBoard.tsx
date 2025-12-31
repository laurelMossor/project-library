import { useState } from "react";
import { FilterType, SortType, ViewType } from "@/lib/hooks/useFilter";

type FilterBoardProps = {
	search: string;
	onSearchChange: (value: string) => void;
	filter: FilterType;
	onFilterChange: (filter: FilterType) => void;
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
	search,
	onSearchChange,
	filter,
	onFilterChange,
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
			{/* Search bar */}
			<div className="mb-4">
				<input
					type="text"
					placeholder="Search projects and events..."
					value={search}
					onChange={(e) => onSearchChange(e.target.value)}
					className="w-full max-w-md border p-2 rounded"
				/>
			</div>

			{/* Filter tabs, sort, and view toggle */}
			<div className="flex flex-wrap items-center gap-4 mb-4">
				{/* Filter tabs */}
				<div className="flex gap-2 border-b">
					<button
						onClick={() => onFilterChange("all")}
						className={`px-4 py-2 font-medium transition ${
							filter === "all"
								? "border-b-2 border-black text-black"
								: "text-gray-600 hover:text-black"
						}`}
					>
						All
					</button>
					<button
						onClick={() => onFilterChange("projects")}
						className={`px-4 py-2 font-medium transition ${
							filter === "projects"
								? "border-b-2 border-black text-black"
								: "text-gray-600 hover:text-black"
						}`}
					>
						Projects
					</button>
					<button
						onClick={() => onFilterChange("events")}
						className={`px-4 py-2 font-medium transition ${
							filter === "events"
								? "border-b-2 border-black text-black"
								: "text-gray-600 hover:text-black"
						}`}
					>
						Events
					</button>
				</div>

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

