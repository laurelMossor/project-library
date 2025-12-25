import Image from "next/image";
import { Project } from "../../types/project";
import { formatDateTime } from "../../utils/datetime";
import { truncateText } from "../../utils/text";
import Link from "next/link";

const WeirdLittleButton = () => {
	return (
		<button className="rounded-full">
			<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
				<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
			</svg>
		</button>
	);
};

const ProjectImage = ({ project }: { project: Project }) => {
	return (project.imageUrl ? (
		<div className="relative" style={{ maxWidth: '400px', maxHeight: '500px' }}>
			<Image
				src={project.imageUrl}
				alt={project.title}
				width={400}
				height={192}
				className="max-w-full max-h-full object-contain"
				style={{ width: 'auto', height: 'auto' }}
				unoptimized
			/>
		</div>
	) : (
		<div className="w-full h-full flex items-center justify-center text-gray-400">
			No image
		</div>
	))
};

const ProjectImageCarousel = ({ project }: { project: Project }) => {
	return (	
	<div className="mb-4 flex items-center gap-2">
		{/* Left side frame (placeholder) */}
		<div className="w-16 h-32 soft-grey rounded border border-warm-grey flex-shrink-0"></div>

		{/* Central image area with navigation arrows */}
		<div className="flex-1 relative h-48 overflow-hidden flex items-center justify-center">
			<WeirdLittleButton />
			<ProjectImage project={project} />
			<WeirdLittleButton />
		</div>
		
		{/* Right side frame (placeholder) */}
		<div className="w-16 h-32 soft-grey rounded border border-warm-grey flex-shrink-0"></div>
    </div>
)};

export const ProjectEntry = ({ project, truncate }: { project: Project, truncate?: boolean }) => {
	return (
		<>
			<p className="text-gray-600 text-sm mb-2 line-clamp-3">
				{truncate ? truncateText(project.description, 250) : project.description}
			</p>
			<div className="flex flex-row items-center gap-2">
				<Link 
					href={`/u/${project.owner.username}`}
					className="text-sm text-gray-600 hover:underline"
				>
					{project.owner.name || project.owner.username}
				</Link>
				<p className="text-xs text-gray-500">
					{formatDateTime(project.createdAt)}
				</p>
			</div>

			{/* Middle section: Image carousel area */}
			{project.imageUrl && <ProjectImageCarousel project={project} />}
		</>
	);
};

