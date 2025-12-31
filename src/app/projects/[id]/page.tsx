import { getProjectById } from "@/lib/utils/server/project";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { DeleteProjectButton } from "@/lib/components/project/DeleteProjectButton";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";

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
				<CollectionCard item={project} truncate={false} />
				<div className="mt-8 flex gap-4 items-center flex-wrap">
					{isOwner && (
						<>
							<ButtonLink href={`/projects/${id}/entries/new`}>
								New Entry
							</ButtonLink>
							<ButtonLink href={`/projects/${id}/edit`}>
								Edit Project
							</ButtonLink>
						</>
					)}
					{session && !isOwner && (
						<ButtonLink href={`/messages/${project.owner.id}`}>
							Message Owner
						</ButtonLink>
					)}
					{isOwner && <DeleteProjectButton projectId={id} projectTitle={project.title} />}
					<Link href="/collections" className="underline">Back to collections</Link>
					<Link href="/" className="underline">Home</Link>
				</div>
			</div>
		</main>
	);
}

