import Image from "next/image";
import { Project } from "../../types/project";
import { formatDateTime } from "../../utils/datetime";
import { getInitials, truncateText } from "../../utils/text";
import Link from "next/link";

const TitleHeaderLink = ({ project }: { project: Project }) => {
	return (
		<Link href={`/projects/${project.id}`}>
			<h2 className="text-xl font-semibold mb-2 hover:underline">{project.title}</h2>
		</Link>
	);
};

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

///////////////////////////////////////////////
export const ProjectCard = ({ project }: { project: Project }) => {
	const initials = getInitials(project.owner.name, project.owner.username);

	return (
		<div className="border rounded p-4 hover:shadow-lg transition-shadow flex flex-col">
			{/* Top section: Profile pic, title, description, date */}
			<div className="mb-4">
				<div className="flex items-start gap-3 mb-2">
					{/* Circular profile pic placeholder */}
					<div className="w-12 h-12 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0">
						<span className="text-gray-600 font-medium text-sm">{initials}</span>
					</div>
					
					{/* Title and description */}
					<div className="flex-1 min-w-0">
						<TitleHeaderLink project={project} />
						<Link 
							href={`/u/${project.owner.username}`}
							className="text-sm text-gray-600 hover:underline mb-2 block"
						>
							{project.owner.name || project.owner.username}
						</Link>
						<p className="text-gray-600 text-sm mb-2 line-clamp-3">
							{truncateText(project.description, 250)}
						</p>
						<p className="text-xs text-gray-500">
							{formatDateTime(project.createdAt)}
						</p>
					</div>
				</div>
			</div>

			{/* Middle section: Image carousel area */}
			{project.imageUrl && <ProjectImageCarousel project={project} />}

			{/* Bottom section: Tags as plain boxes */}
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