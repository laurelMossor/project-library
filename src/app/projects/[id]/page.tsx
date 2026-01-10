import { getProjectById } from "@/lib/utils/server/project";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { DeleteProjectButton } from "@/lib/components/project/DeleteProjectButton";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { PROJECT_POST_NEW, PROJECT_EDIT, MESSAGE_CONVERSATION, COLLECTIONS, HOME } from "@/lib/const/routes";
import { getOwnerUser, getOwnerId } from "@/lib/utils/owner";

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

	// Check if current user is the project owner (via Actor)
	const ownerUser = getOwnerUser(project.owner);
	const ownerId = getOwnerId(project.owner);
	const isOwner = session?.user?.id === ownerId;

	return (
		<CenteredLayout maxWidth="2xl">
			<CollectionCard item={project} truncate={false} />
			<div className="mt-8 flex gap-4 items-center flex-wrap">
				{isOwner && (
					<>
						<ButtonLink href={PROJECT_POST_NEW(id)}>
							New Post
						</ButtonLink>
						<ButtonLink href={PROJECT_EDIT(id)}>
							Edit Project
						</ButtonLink>
					</>
				)}
				{session && !isOwner && ownerId && (
					<ButtonLink href={MESSAGE_CONVERSATION(ownerId)}>
						Message Owner
					</ButtonLink>
				)}
				{isOwner && <DeleteProjectButton projectId={id} projectTitle={project.title} />}
				<Link href={COLLECTIONS} className="underline">Back to collections</Link>
				<Link href={HOME} className="underline">Home</Link>
			</div>
		</CenteredLayout>
	);
}

