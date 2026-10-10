import { getEventById } from "@/lib/utils/server/event";
import { getUserById } from "@/lib/utils/server/user";
import { getRsvpByEmail, getRsvpCounts, getRsvpsByEvent } from "@/lib/utils/server/rsvp";
import { getEventComments } from "@/lib/utils/server/comment";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { EventPageClient } from "@/lib/components/event/EventPageClient";
import { getUserDisplayName } from "@/lib/types/user";
import type { RsvpStatus } from "@/lib/types/rsvp";
import type { CardUser } from "@/lib/types/card";
import { getViewerContext, canViewEvent } from "@/lib/utils/server/visibility";
import { canEditContent, canModerateContent } from "@/lib/utils/server/permission";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
	const { id } = await params;
	const [event, session, viewer] = await Promise.all([getEventById(id), auth(), getViewerContext()]);

	if (!event) {
		notFound();
	}

	const authority = { userId: event.userId, asPageId: event.asPageId, pageId: event.pageId };
	const [canEdit, canModerate] = session?.user?.id
		? await Promise.all([
			canEditContent(session.user.id, authority),
			canModerateContent(session.user.id, authority),
		])
		: [false, false];

	// Drafts are visible to whoever may edit the words. Losing the page role
	// hides a page-spoken draft even from the person who created it.
	if (event.status === "DRAFT" && !canEdit) {
		notFound();
	}

	// Visibility gate: PRIVATE events are 404 for unauthorized viewers
	if (!(await canViewEvent(event, viewer))) {
		notFound();
	}

	let initialName: string | undefined;
	let initialEmail: string | undefined;
	let existingRsvpStatus: RsvpStatus | undefined;
	let initialGuestName: string | null | undefined;
	let initialHasPlusOne: boolean | undefined;
	let memberUser: CardUser | undefined;

	// For published events, pre-fill RSVP and surface any existing RSVP for logged-in users
	if (session?.user?.id && event.status === "PUBLISHED") {
		const user = await getUserById(session.user.id);
		if (user) {
			initialName = getUserDisplayName(user);
			initialEmail = user.email;
			memberUser = {
				id: user.id,
				handle: user.handle,
				displayName: user.displayName,
				avatarImageId: user.avatarImageId,
				avatarImage: user.avatarImage,
			};
			const existingRsvp = await getRsvpByEmail(id, user.email);
			if (existingRsvp) {
				existingRsvpStatus = existingRsvp.status;
				initialHasPlusOne = existingRsvp.guests.length > 0;
				initialGuestName = existingRsvp.guests[0]?.name ?? null;
			}
		}
	}

	// Published events carry a comment thread and RSVPs; drafts can't be commented on or RSVPed to yet.
	// The attendee list (names + emails) follows canEditContent, same as the organizer's view always did.
	const isPublished = event.status === "PUBLISHED";
	const [comments, rsvpCounts, rsvps] = await Promise.all([
		isPublished ? getEventComments(id) : [],
		isPublished ? getRsvpCounts(id) : null,
		isPublished && canEdit ? getRsvpsByEvent(id) : null,
	]);

	return (
		<EventPageClient
			event={event}
			comments={comments}
			canEdit={canEdit}
			canModerate={canModerate}
			isLoggedIn={!!session?.user}
			initialName={initialName}
			initialEmail={initialEmail}
			existingRsvpStatus={existingRsvpStatus}
			initialGuestName={initialGuestName}
			initialHasPlusOne={initialHasPlusOne}
			memberUser={memberUser}
			rsvpCounts={rsvpCounts}
			rsvps={rsvps}
		/>
	);
}
