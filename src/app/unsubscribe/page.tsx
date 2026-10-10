"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { AuthCard } from "@/lib/components/auth/AuthCard";
import { PROFILE_SETTINGS, UNSUBSCRIBE_TOKEN_QUERY } from "@/lib/const/routes";
import { useAction } from "@/lib/hooks/useAction";
import { unsubscribeAction } from "@/lib/actions/auth";

/**
 * Unsubscribe confirm page. Reaching it does nothing (GET is read-only, so email link-scanners that
 * prefetch it can't unsubscribe anyone) — the opt-out happens only on the deliberate confirm click.
 */
function UnsubscribeInner() {
	const token = useSearchParams().get(UNSUBSCRIBE_TOKEN_QUERY)?.trim() ?? "";
	// The context label once unsubscribed ("your personal" or a page name); null until then.
	const [label, setLabel] = useState<string | null>(null);
	const { run, pending, error } = useAction(unsubscribeAction);

	async function confirm() {
		const result = await run({ token });
		if (result.ok) setLabel(result.data);
	}

	if (!token) {
		return (
			<AuthCard>
				<h1 className="text-xl font-semibold text-rich-brown">Unsubscribe</h1>
				<p className="text-misty-forest">This unsubscribe link is missing or malformed.</p>
			</AuthCard>
		);
	}

	if (label !== null) {
		return (
			<AuthCard>
				<h1 className="text-xl font-semibold text-rich-brown">You’re unsubscribed</h1>
				<p className="text-misty-forest">
					You’ll no longer receive {label ? `${label} ` : ""}email notifications. You can turn them back on
					anytime in{" "}
					<Link href={PROFILE_SETTINGS} className="text-moss-green underline">
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
			<Button onClick={confirm} disabled={pending}>
				{pending ? "Unsubscribing…" : "Confirm unsubscribe"}
			</Button>
			{error ? <p className="text-sm text-red-600">{error}</p> : null}
			<p className="text-sm text-misty-forest">
				Prefer to fine-tune instead?{" "}
				<Link href={PROFILE_SETTINGS} className="text-moss-green underline">
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
