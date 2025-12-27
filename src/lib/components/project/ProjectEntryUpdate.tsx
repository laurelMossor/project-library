import { ProjectEntryItem } from "@/lib/utils/project-entry";
import { formatDateTime } from "@/lib/utils/datetime";

interface ProjectEntryUpdateProps {
	entry: ProjectEntryItem;
}

export const ProjectEntryUpdate = ({ entry }: ProjectEntryUpdateProps) => {
	return (
		<div className="mt-4 pt-4 border-t border-soft-grey">
			{entry.title && (
				<h3 className="font-semibold text-sm mb-2">{entry.title}</h3>
			)}
			<p className="text-warm-grey text-sm mb-2 whitespace-pre-wrap">{entry.content}</p>
			<p className="text-xs text-warm-grey">
				{formatDateTime(entry.createdAt)}
			</p>
		</div>
	);
};

