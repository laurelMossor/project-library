import { Project } from "../../types/project";
import Link from "next/link";
import { ProfilePicPlaceholder } from "../user/ProfilePicPlaceholder";
import { ProjectEntry } from "./ProjectEntry";

const TitleHeaderLink = ({ project }: { project: Project }) => {
	return (
		<Link href={`/projects/${project.id}`}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};


export const ProjectCard = ({ project }: { project: Project }) => {
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
			<ProjectEntry project={project} />

			{project.tags && project.tags.length > 0 && (
				<div className="flex flex-wrap gap-2 mt-auto">
					{project.tags.map((tag) => (
						<div
							key={tag}
							className="px-3 py-1 border border-gray-300 rounded text-xs"
						>
							{tag}
						</div>
					))}
				</div>
			)}
		</div>
	);
};