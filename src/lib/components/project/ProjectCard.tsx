import { ProjectItem } from "../../types/project";
import Link from "next/link";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { ProjectEntry } from "./ProjectEntry";
import { Tag, Tags } from "../tag";

const TitleHeaderLink = ({ project }: { project: ProjectItem }) => {
	return (
		<Link href={`/projects/${project.id}`}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};


export const ProjectCard = ({ project, truncate }: { project: ProjectItem, truncate?: boolean }) => {
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
			<ProjectEntry project={project} truncate={truncate} />

			<Tags item={project} />
		</div>
	);
};