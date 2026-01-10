import { getProjectById } from "@/lib/utils/server/project";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EditProjectForm } from "@/lib/components/project/EditProjectForm";
import { PROJECT_DETAIL } from "@/lib/const/routes";
import { getActorIdForUser, actorOwnsProject } from "@/lib/utils/server/actor";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EditProjectPage({ params }: Props) {
	const { id } = await params;
	const project = await getProjectById(id);
	const session = await auth();

	if (!project) {
		notFound();
	}

	// Check if current user is the project owner (via Actor)
	if (!session?.user?.id) {
		redirect(PROJECT_DETAIL(id));
	}
	const actorId = await getActorIdForUser(session.user.id);
	if (!actorId || !(await actorOwnsProject(actorId, id))) {
		redirect(PROJECT_DETAIL(id));
	}

	return <EditProjectForm project={project} />;
}

