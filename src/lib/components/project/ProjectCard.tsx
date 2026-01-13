/**
 * @deprecated This component has been replaced by CollectionCard.
 * Use CollectionCard from @/lib/components/collection/CollectionCard instead.
 * 
 * Migration: Replace <ProjectCard project={project} /> with <CollectionCard item={project} />
 * 
 * This component will be removed in a future version.
 */
import { ProjectItem } from "../../types/project";
import Link from "next/link";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { Tag, Tags } from "../tag";
import { truncateText } from "../../utils/text";
import { formatDateTime } from "../../utils/datetime";
import ImageCarousel from "../images/ImageCarousel";
import { PostsList } from "../post/PostsList";
import { PROJECT_DETAIL, PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "../../const/routes";
import { getOwnerUser, getOwnerDisplayName, getOwnerUsername } from "../../utils/owner";

const TitleHeaderLink = ({ project }: { project: ProjectItem }) => {
	return (
		<Link href={PROJECT_DETAIL(project.id)}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};

/** @deprecated Use CollectionCard instead */
export const ProjectCard = ({ project, truncate = true }: { project: ProjectItem, truncate?: boolean }) => {
	const ownerUser = getOwnerUser(project.owner);
	const ownerDisplayName = getOwnerDisplayName(project.owner);
	const ownerUsername = getOwnerUsername(project.owner);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					{ownerUser && <ProfilePicPlaceholder owner={ownerUser} />}
					<div className="flex-1 min-w-0">
						<TitleHeaderLink project={project} />
					</div>
				</div>
			</div>
			
			<p className="text-warm-grey text-sm mb-2">
				{truncate ? truncateText(project.description, 250) : project.description}
			</p>
			
			<div className="flex flex-row items-center gap-2 mb-2">
				{ownerUsername && (
					<Link 
						href={project.owner.type === "USER" ? PUBLIC_USER_PAGE(ownerUsername) : PUBLIC_ORG_PAGE(ownerUsername)}
						className="text-sm text-rich-brown hover:underline"
					>
						{ownerDisplayName}
					</Link>
				)}
				<p className="text-xs text-warm-grey">
					{formatDateTime(project.createdAt)}
				</p>
			</div>

			{project.images && project.images.length > 0 && (
				<div className="mb-4">
					<ImageCarousel images={project.images} />
				</div>
			)}

			<PostsList 
				collectionId={project.id} 
				collectionType="project" 
				showTitle={true}
			/>

			<Tags item={project} />
		</div>
	);
};