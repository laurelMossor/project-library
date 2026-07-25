import { getEventById } from "@/lib/utils/server/event";
import { getUserById } from "@/lib/utils/server/user";
import { getRsvpByEmail } from "@/lib/utils/server/rsvp";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { EventPageClient } from "@/lib/components/event/EventPageClient";
import { getUserDisplayName } from "@/lib/types/user";
import type { RsvpStatus } from "@/lib/types/rsvp";
import { getViewerContext, canViewEvent } from "@/lib/utils/server/visibility";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
	const { id } = await params;
	const [event, session, viewer] = await Promise.all([getEventById(id), auth(), getViewerContext()]);

	if (!event) {
		notFound();
	}

	const isOwner = session?.user?.id === event.userId;

	// Draft events are only visible to the owner
	if (event.status === "DRAFT" && !isOwner) {
		notFound();
	}

	// Visibility gate: PRIVATE events are 404 for unauthorized viewers
	if (!(await canViewEvent(event, viewer))) {
		notFound();
	}

	let initialName: string | undefined;
	let initialEmail: string | undefined;
	let existingRsvpStatus: RsvpStatus | undefined;

	// For published events, pre-fill RSVP form and surface any existing RSVP for logged-in users
	if (session?.user?.id && event.status === "PUBLISHED") {
		const user = await getUserById(session.user.id);
		if (user) {
			initialName = getUserDisplayName(user);
			initialEmail = user.email;
			const existingRsvp = await getRsvpByEmail(id, user.email);
			if (existingRsvp) {
				existingRsvpStatus = existingRsvp.status;
			}
		}
	}

	return (
		<EventPageClient
			event={event}
			isOwner={isOwner}
			isLoggedIn={!!session?.user}
			initialName={initialName}
			initialEmail={initialEmail}
			existingRsvpStatus={existingRsvpStatus}
		/>
	);
}
