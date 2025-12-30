import { ProjectItem } from "../../types/project";
import Link from "next/link";
import Image from "next/image";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { Tag, Tags } from "../tag";
import { truncateText } from "../../utils/text";
import { formatDateTime } from "../../utils/datetime";

const TitleHeaderLink = ({ project }: { project: ProjectItem }) => {
	return (
		<Link href={`/projects/${project.id}`}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};

const ProjectImage = ({ project }: { project: ProjectItem }) => {
	const firstImage = project.images && project.images.length > 0 ? project.images[0] : null;
	return firstImage ? (
		<div className="relative mb-4" style={{ maxWidth: '400px', maxHeight: '500px' }}>
			<Image
				src={firstImage.url}
				alt={firstImage.altText || project.title}
				width={400}
				height={192}
				className="max-w-full max-h-full object-contain"
				style={{ width: 'auto', height: 'auto' }}
				unoptimized
			/>
		</div>
	) : null;
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

			<ProjectImage project={project} />

			<Tags item={project} />
		</div>
	);
};