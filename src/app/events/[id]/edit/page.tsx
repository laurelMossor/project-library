import { getEventById } from "@/lib/utils/server/event";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EditEventForm } from "@/lib/components/event/EditEventForm";
import { EVENT_DETAIL } from "@/lib/const/routes";
import { getOwnerIdForUser, ownerOwnsEvent } from "@/lib/utils/server/owner";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EditEventPage({ params }: Props) {
	const { id } = await params;
	const event = await getEventById(id);
	const session = await auth();

	if (!event) {
		notFound();
	}

	// Check if current user is the event owner (via Owner)
	if (!session?.user?.id) {
		redirect(EVENT_DETAIL(id));
	}
	const ownerId = await getOwnerIdForUser(session.user.id, session.user.activeOwnerId);
	if (!ownerId || !(await ownerOwnsEvent(ownerId, id))) {
		redirect(EVENT_DETAIL(id));
	}

	return <EditEventForm event={event} />;
}
