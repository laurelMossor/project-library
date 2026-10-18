"use client";

import { useState, useMemo } from "react";
import { CollectionItem, AboutCollectionItem } from "@/lib/types/collection";
import { pinnedCountInScope, type PinScope } from "@/lib/const/pin";
import { useFilter } from "@/lib/hooks/useFilter";
import { CollectionPage } from "./CollectionPage";
import { CollectionCreateButton } from "./CollectionCreateButton";
import type { NewItemTarget } from "@/lib/components/nav-bar/NewItemModal";

type ProfileCollectionSectionProps = {
	items: CollectionItem[];
	/** The profile whose pin slot these buttons spend. */
	pinScope: PinScope;
	/** Synthetic cards prepended before the filterable collection (e.g. About card). */
	prependCards?: AboutCollectionItem[];
	emptyMessage?: string;
	showCreateLinks?: boolean;
	/** Set when the viewer may post to or as this profile; shows "+ Create" aimed at it. */
	createTarget?: NewItemTarget;
};

/**
 * ProfileCollectionSection — shared collection section for User and Page profile pages.
 * Renders a filterable, sortable grid of events/posts belonging to a profile entity.
 * No heading: the profile header above already names the owner.
 */
export function ProfileCollectionSection({
	items,
	pinScope,
	prependCards = [],
	emptyMessage = "There's nothing here yet.",
	showCreateLinks = true,
	createTarget,
}: ProfileCollectionSectionProps) {
	const [search, setSearch] = useState("");

	// Filter items by search (client-side filtering for profile's own collection)
	const filteredBySearch = useMemo(() => {
		if (!search.trim()) return items;

		const searchLower = search.toLowerCase();
		return items.filter((item) => {
			return (
				(item.title || "").toLowerCase().includes(searchLower) ||
				item.content.toLowerCase().includes(searchLower) ||
				item.tags.some((tag) => tag.toLowerCase().includes(searchLower))
			);
		});
	}, [items, search]);

	const {
		filteredItems,
		collectionTypeFilter,
		setCollectionTypeFilter,
		sort,
		setSort,
		view,
		setView,
		selectedTags,
		setSelectedTags,
		availableTags,
	} = useFilter(filteredBySearch);

	// Post-sort: pinned items float to top of the profile view (not affected on explore page)
	const pinnedFirstItems = useMemo(() => {
		const pinned = filteredItems.filter((item) => item.pinnedAt !== null);
		const unpinned = filteredItems.filter((item) => item.pinnedAt === null);
		pinned.sort((a, b) => new Date(b.pinnedAt!).getTime() - new Date(a.pinnedAt!).getTime());
		return [...pinned, ...unpinned];
	}, [filteredItems]);

	// Cap counts only this profile's pin slot, not page pins listed on a user profile.
	const pinnedCount = useMemo(
		() => pinnedCountInScope(items, pinScope),
		[items, pinScope]
	);

	const pinConfig = { pinnedCount };

	const hasLocationData = useMemo(
		() => items.some((item) => {
			if ("latitude" in item && "longitude" in item) {
				return item.latitude !== null && item.longitude !== null;
			}
			return false;
		}),
		[items]
	);

	return (
		<div className="mt-8 pt-8 border-t">
			<CollectionPage
				filteredItems={pinnedFirstItems}
				prependItems={prependCards}
				loading={false}
				error=""
				search={search}
				onSearchChange={setSearch}
				collectionTypeFilter={collectionTypeFilter}
				onCollectionTypeChange={setCollectionTypeFilter}
				sort={sort}
				onSortChange={setSort}
				view={view}
				onViewChange={setView}
				hasLocationData={hasLocationData}
				selectedTags={selectedTags}
				onTagsChange={setSelectedTags}
				availableTags={availableTags}
				headerAction={createTarget && <CollectionCreateButton target={createTarget} />}
				emptyMessage={emptyMessage}
				showCreateLinks={showCreateLinks}
				pinConfig={pinConfig}
			/>
		</div>
	);
}
