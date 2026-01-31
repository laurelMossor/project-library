import Link from "next/link";
import { FilterCollectionType } from "@/lib/types/collection";
import { PROJECT_NEW, EVENT_NEW } from "@/lib/const/routes";
import { CreationCTA } from "./CreationCTA";

type EmptyStateProps = {
	collectionTypeFilter: FilterCollectionType;
	search: string;
	showCreateLinks?: boolean;
};

export function EmptyState({
	collectionTypeFilter,
	search,
	showCreateLinks = true,
}: EmptyStateProps) {
	const getItemLabel = () => {
		switch (collectionTypeFilter) {
			case "project":
				return "projects";
			case "event":
				return "events";
			default:
				return "items";
		}
	};

	const getMessage = () => {
		const label = getItemLabel();
		if (search) {
			return `No ${label} found matching "${search}".`;
		}
		return `No ${label} yet.`;
	};

	return (
		<div className="text-center py-12">
			<p className="text-gray-600 mb-2">{getMessage()}</p>
			<p className="text-gray-500 text-sm mb-4">Try adjusting your search or filters, or be the first to create one!</p>
			{showCreateLinks && (
				<CreationCTA collectionTypeFilter={collectionTypeFilter} />
			)}
		</div>
	);
}
