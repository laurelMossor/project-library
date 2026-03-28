// Route entry point — no logic lives here.
// All creation UI and state is in src/lib/components/event/CreateEventPage.tsx,
// mirroring the pattern used by src/app/events/[id]/page.tsx → EventPageClient.
import { CreateEventPage } from "@/lib/components/event/CreateEventPage";

export default function NewEventPage() {
	return <CreateEventPage />;
}
