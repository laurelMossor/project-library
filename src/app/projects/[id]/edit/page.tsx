import { getProjectById } from "@/lib/utils/server/project";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EditProjectForm } from "@/lib/components/project/EditProjectForm";
import { PROJECT_DETAIL } from "@/lib/const/routes";
import { getOwnerIdForUser, ownerOwnsProject } from "@/lib/utils/server/owner";

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

	// Check if current user is the project owner (via Owner)
	if (!session?.user?.id) {
		redirect(PROJECT_DETAIL(id));
	}
	const ownerId = await getOwnerIdForUser(session.user.id, session.user.activeOwnerId);
	if (!ownerId || !(await ownerOwnsProject(ownerId, id))) {
		redirect(PROJECT_DETAIL(id));
	}

	return <EditProjectForm project={project} />;
}
