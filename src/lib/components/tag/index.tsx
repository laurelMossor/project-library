import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";

export interface Tag {
	title: string;
    // childOf?: string;
}

const CollectionTypeBadge = ({ item }: { item: ProjectItem | EventItem }) => {
    return (
        <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700 uppercase">
                {item.type}
            </span>
        </div>
    );
};

export const Tag = ({ tag }: { tag: string }) => {
	return (
		<div className="px-3 py-1 border bg-melon-green border-soft-grey rounded text-xs">
			{tag}
		</div>
	);
};

export const Tags = ({ item }: { item: ProjectItem | EventItem }) => {
	const itemHasTags = item.tags && item.tags.length > 0;

	return (
		<div className="flex flex-wrap gap-2 mt-auto">
			<CollectionTypeBadge item={item} />
			{itemHasTags && item.tags.map((tag) => (
				<Tag key={tag} tag={tag} />
			))}
		</div>
	);
};