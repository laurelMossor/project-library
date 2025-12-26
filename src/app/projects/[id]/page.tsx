import { getProjectById } from "@/lib/utils/project";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ProjectCard } from "@/lib/components/project/ProjectCard";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function ProjectDetailPage({ params }: Props) {
	const { id } = await params;
	const project = await getProjectById(id);
	const session = await auth();

	if (!project) {
		notFound();
	}

	// Check if current user is the project owner (only show message button if not owner)
	const isOwner = session?.user?.id === project.owner.id;

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-2xl">
				<ProjectCard project={project} />
				<div className="mt-8 flex gap-4 items-center">
					{session && !isOwner && (
						<Link
							href={`/messages/${project.owner.id}`}
							className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
						>
							Message Owner
						</Link>
					)}
					<Link href="/collections" className="underline">Back to collections</Link>
					<Link href="/" className="underline">Home</Link>
				</div>
			</div>
		</main>
	);
}

