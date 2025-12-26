import { CollectionItem, isEvent } from "@/lib/types/collection";
import { getCollectionItemKey } from "@/lib/utils/collection";
import { ProjectCard } from "../project/ProjectCard";
import { EventCard } from "../event/EventCard";

type CollectionCardProps = {
	item: CollectionItem;
	truncate?: boolean;
};

export const CollectionItemCard = ({ item, truncate }: CollectionCardProps) => {
	return isEvent(item) ? (
		<EventCard key={getCollectionItemKey(item)} event={item} truncate={truncate} />
	) : (
		<ProjectCard key={getCollectionItemKey(item)} project={item} truncate={truncate} />
	);
}

