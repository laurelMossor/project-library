import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";
import { itemHasCollectionType } from "@/lib/utils/collection";
import { CollectionTypeBadge } from "./CollectionTypeBadge";

export interface Tag {
	title: string;
    // childOf?: string;
}

export const Tag = ({ tag }: { tag: string }) => {
	return (
		<div className="px-3 py-1 border text-grey-white bg-whale-blue rounded text-xs">
			{tag}
		</div>
	);
};

export const Tags = ({ item }: { item: ProjectItem | EventItem }) => {
	const itemHasTags = item.tags && item.tags.length > 0;

	return (
		<div className="flex flex-wrap gap-2 mt-auto">
			{itemHasCollectionType(item) && <CollectionTypeBadge title={item.type} />}
			{itemHasTags && item.tags.map((tag) => (
				<Tag key={tag} tag={tag} />
			))}
		</div>
	);
};