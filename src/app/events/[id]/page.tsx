// Route entry point — server-side data fetching and auth only.
// All display and editing UI is in src/lib/components/event/EventPageClient.tsx,
// mirroring the pattern used by src/app/events/new/page.tsx → CreateEventPage.
import { getEventById } from "@/lib/utils/server/event";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { EventPageClient } from "@/lib/components/event/EventPageClient";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function EventDetailPage({ params }: Props) {
	const { id } = await params;
	const event = await getEventById(id);
	const session = await auth();

	if (!event) {
		notFound();
	}

	const isOwner = session?.user?.id === event.userId;

	// Draft events are only visible to the owner
	if (event.status === "DRAFT" && !isOwner) {
		notFound();
	}

	return (
		<EventPageClient
			event={event}
			isOwner={isOwner}
			isLoggedIn={!!session?.user}
		/>
	);
}
