"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftEvent } from "@/lib/utils/event-client";
import { AuthError } from "@/lib/utils/auth-client";
import { EVENT_DETAIL, LOGIN_WITH_CALLBACK, EVENT_NEW } from "@/lib/const/routes";

/**
 * /events/new — Creates a draft event and redirects to the event page for inline editing.
 * The event page IS the creation surface.
 */
export default function NewEventPage() {
	const router = useRouter();
	const [error, setError] = useState("");

	useEffect(() => {
		createDraftEvent()
			.then((event) => {
				router.replace(EVENT_DETAIL(event.id));
			})
			.catch((err) => {
				if (err instanceof AuthError) {
					router.push(LOGIN_WITH_CALLBACK(EVENT_NEW));
					return;
				}
				setError(err instanceof Error ? err.message : "Failed to create event");
			});
	}, [router]);

	if (error) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
				<div className="text-center space-y-4">
					<p className="text-alert-red">{error}</p>
					<button
						type="button"
						onClick={() => router.back()}
						className="text-sm font-medium text-gray-500 underline underline-offset-2"
					>
						Go back
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
			<p className="text-gray-500">Creating your event...</p>
		</main>
	);
}
