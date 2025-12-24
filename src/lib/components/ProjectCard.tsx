import { useRouter } from "next/navigation";
import Image from "next/image";
import { truncateText } from "../utils/text";
import { Project } from "../types/project";
import Link from "next/link";

export const ProjectCard = ({ project }: { project: Project }) => {
	const router = useRouter();
	return (
		<div
			onClick={() => router.push(`/projects/${project.id}`)}
			className="border rounded p-4 hover:shadow-lg transition-shadow cursor-pointer"
		>
		{project.imageUrl && (
			<div className="mb-3 w-full h-48 overflow-hidden rounded">
				<Image
					src={project.imageUrl}
					alt={project.title}
					width={400}
					height={192}
					className="w-full h-full object-cover"
					unoptimized
				/>
			</div>
		)}
		<h2 className="text-xl font-semibold mb-2">{project.title}</h2>
		<p className="text-gray-600 mb-3">{truncateText(project.description)}</p>

		{project.tags && project.tags.length > 0 && (
			<div className="mb-3 flex flex-wrap gap-2">
				{project.tags.map((tag) => (
					<span
						key={tag}
						className="px-2 py-1 bg-gray-100 rounded text-xs"
					>
						{tag}
					</span>
				))}
			</div>
		)}

		<div className="text-sm text-gray-500">
			<p>
				By{" "}
				<Link
					href={`/u/${project.owner.username}`}
					onClick={(e) => e.stopPropagation()}
					className="underline hover:text-gray-700"
				>
					{project.owner.name || project.owner.username}
				</Link>
			</p>
			<p className="mt-1">
				{new Date(project.createdAt).toLocaleDateString()}
			</p>
		</div>
	</div>
	)
}