import { ProjectItem } from "../../types/project";
import Link from "next/link";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { Tag, Tags } from "../tag";
import { truncateText } from "../../utils/text";
import { formatDateTime } from "../../utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { EntriesList } from "../entry/EntriesList";

const TitleHeaderLink = ({ project }: { project: ProjectItem }) => {
	return (
		<Link href={`/projects/${project.id}`}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};

export const ProjectCard = ({ project, truncate = true }: { project: ProjectItem, truncate?: boolean }) => {
	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					<ProfilePicPlaceholder project={project} />
					<div className="flex-1 min-w-0">
						<TitleHeaderLink project={project} />
					</div>
				</div>
			</div>
			
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(project.description, 250) : project.description}
			</p>
			
			<div className="flex flex-row items-center gap-2 mb-2">
				<Link 
					href={`/u/${project.owner.username}`}
					className="text-sm text-rich-brown hover:underline"
				>
					{project.owner.name || project.owner.username}
				</Link>
				<p className="text-xs text-warm-grey">
					{formatDateTime(project.createdAt)}
				</p>
			</div>

			{project.images && project.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={project.images} />
				</div>
			)}

			<EntriesList 
				collectionId={project.id} 
				collectionType="project" 
				showTitle={true}
			/>

			<Tags item={project} />
		</div>
	);
};