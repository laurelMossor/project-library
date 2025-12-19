import { getProjectById } from "@/lib/utils/project";
import { notFound } from "next/navigation";
import Link from "next/link";
import Image from "next/image";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
	const { id } = await params;
	const project = await getProjectById(id);

	if (!project) {
		notFound();
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-2xl">
				{project.imageUrl && (
					<div className="mb-6 w-full h-96 overflow-hidden rounded">
						<Image
							src={project.imageUrl}
							alt={project.title}
							width={800}
							height={384}
							className="w-full h-full object-cover"
							unoptimized
						/>
					</div>
				)}
				<h1 className="text-3xl font-bold">{project.title}</h1>

				<div className="mt-4 text-sm text-gray-500">
					<p>
						By{" "}
						<Link
							href={`/u/${project.owner.username}`}
							className="underline hover:text-gray-700"
						>
							{project.owner.name || project.owner.username}
						</Link>
					</p>
					<p className="mt-1">
						Created {new Date(project.createdAt).toLocaleDateString()}
					</p>
				</div>

				{project.tags && project.tags.length > 0 && (
					<div className="mt-6">
						<h2 className="text-sm font-medium text-gray-500">Tags</h2>
						<div className="mt-2 flex flex-wrap gap-2">
							{project.tags.map((tag) => (
								<span
									key={tag}
									className="px-2 py-1 bg-gray-100 rounded text-sm"
								>
									{tag}
								</span>
							))}
						</div>
					</div>
				)}

				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500 mb-2">Description</h2>
					<p className="whitespace-pre-wrap">{project.description}</p>
				</div>

				<div className="mt-8 flex gap-4">
					<Link href="/projects" className="underline">Back to projects</Link>
					<Link href="/" className="underline">Home</Link>
				</div>
			</div>
		</main>
	);
}

