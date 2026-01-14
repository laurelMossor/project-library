import { getEventById } from "@/lib/utils/server/event";
import { auth } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { EditEventForm } from "@/lib/components/event/EditEventForm";
import { EVENT_DETAIL } from "@/lib/const/routes";
import { getActorIdForUser, actorOwnsEvent } from "@/lib/utils/server/actor";

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

	// Check if current user is the event owner (via Actor)
	if (!session?.user?.id) {
		redirect(EVENT_DETAIL(id));
	}
	const actorId = await getActorIdForUser(session.user.id);
	if (!actorId || !(await actorOwnsEvent(actorId, id))) {
		redirect(EVENT_DETAIL(id));
	}

	return <EditEventForm event={event} />;
}

