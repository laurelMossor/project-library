"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { API_UNSUBSCRIBE, NOTIFICATIONS_SETTINGS, UNSUBSCRIBE_TOKEN_QUERY } from "@/lib/const/routes";

/**
 * Unsubscribe confirm page. Reaching it does nothing (GET is read-only, so email link-scanners that
 * prefetch it can't unsubscribe anyone) — the opt-out happens only on the deliberate POST below.
 */
function UnsubscribeInner() {
	const token = useSearchParams().get(UNSUBSCRIBE_TOKEN_QUERY)?.trim() ?? "";
	const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
	const [label, setLabel] = useState("");
	const [error, setError] = useState("");

	async function confirm() {
		setState("loading");
		setError("");
		try {
			const res = await fetch(API_UNSUBSCRIBE, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ token }),
			});
			const data = await res.json().catch(() => ({}));
			if (res.ok) {
				setLabel(typeof data.label === "string" ? data.label : "");
				setState("done");
			} else {
				setError(typeof data.error === "string" ? data.error : "Something went wrong.");
				setState("error");
			}
		} catch {
			setError("Something went wrong. Please try again.");
			setState("error");
		}
	}

	if (!token) {
		return (
			<AuthCard>
				<h1 className="text-xl font-semibold text-rich-brown">Unsubscribe</h1>
				<p className="text-misty-forest">This unsubscribe link is missing or malformed.</p>
			</AuthCard>
		);
	}

	if (state === "done") {
		return (
			<AuthCard>
				<h1 className="text-xl font-semibold text-rich-brown">You’re unsubscribed</h1>
				<p className="text-misty-forest">
					You’ll no longer receive {label ? `${label} ` : ""}email notifications. You can turn them back on
					anytime in{" "}
					<Link href={NOTIFICATIONS_SETTINGS} className="text-moss-green underline">
						notification settings
					</Link>
					.
				</p>
			</AuthCard>
		);
	}

	return (
		<AuthCard>
			<h1 className="text-xl font-semibold text-rich-brown">Unsubscribe from emails</h1>
			<p className="text-misty-forest">Stop receiving these email notifications?</p>
			<Button onClick={confirm} disabled={state === "loading"}>
				{state === "loading" ? "Unsubscribing…" : "Confirm unsubscribe"}
			</Button>
			{state === "error" ? <p className="text-sm text-red-600">{error}</p> : null}
			<p className="text-sm text-misty-forest">
				Prefer to fine-tune instead?{" "}
				<Link href={NOTIFICATIONS_SETTINGS} className="text-moss-green underline">
					Manage preferences
				</Link>
			</p>
		</AuthCard>
	);
}

export default function UnsubscribePage() {
	return (
		<Suspense>
			<UnsubscribeInner />
		</Suspense>
	);
}
