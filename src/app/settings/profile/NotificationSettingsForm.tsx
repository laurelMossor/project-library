"use client";

import { useCallback, useEffect, useState } from "react";
import type { NotificationCategory } from "@prisma/client";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { resolveCardIdentity } from "@/lib/types/card";
import { Toggle } from "@/lib/components/forms/Toggle";
import { VisibilitySelector, type SelectorOption } from "@/lib/components/visibility/VisibilitySelector";
import { API_ME_NOTIFICATION_PREFS } from "@/lib/const/routes";

type Prefs = { master: boolean; categories: Record<string, boolean> };

const CATEGORY_ROWS: { key: NotificationCategory; label: string; description: string }[] = [
	{ key: "MESSAGES", label: "Direct messages", description: "When someone sends you a message" },
	{ key: "COMMENTS", label: "Comments", description: "When someone comments on your posts or events" },
	{ key: "REQUESTS", label: "Follow & join requests", description: "Requests to follow you or join a page you manage" },
	{ key: "RSVPS", label: "Event RSVPs", description: "When someone RSVPs to your event" },
	{ key: "FOLLOWS", label: "New followers & members", description: "When someone follows you or joins a page" },
];

type Frequency = "NEVER" | "MONTHLY" | "DAILY" | "INSTANT";

const FREQUENCY_OPTIONS: SelectorOption<Frequency>[] = [
	{ value: "NEVER", label: "Never" },
	{ value: "MONTHLY", label: "Monthly" },
	{ value: "DAILY", label: "Daily" },
	{ value: "INSTANT", label: "As it happens" },
];

/** Flip to false once digests exist. Until then the group only reflects the master switch. */
const FREQUENCY_COMING_SOON = true;

export function NotificationSettingsForm() {
	const { activeEntity, activePageId } = useActiveProfile();
	const [prefs, setPrefs] = useState<Prefs | null>(null);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const load = useCallback(async () => {
		setLoading(true);
		setError("");
		try {
			const res = await fetch(API_ME_NOTIFICATION_PREFS);
			if (!res.ok) throw new Error();
			setPrefs((await res.json()) as Prefs);
		} catch {
			setError("Couldn't load your preferences.");
		} finally {
			setLoading(false);
		}
	}, []);

	// Load, and reload whenever the active identity changes (so the panel shows that profile's prefs).
	useEffect(() => {
		load();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [activePageId]);

	const save = useCallback(
		async (patch: { master?: boolean; categories?: Record<string, boolean> }) => {
			setSaving(true);
			setError("");
			try {
				const res = await fetch(API_ME_NOTIFICATION_PREFS, {
					method: "PUT",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(patch),
				});
				if (!res.ok) throw new Error();
				setPrefs((await res.json()) as Prefs);
			} catch {
				setError("Couldn't save — reverting.");
				await load();
			} finally {
				setSaving(false);
			}
		},
		[load],
	);

	const whose = activePageId && activeEntity ? resolveCardIdentity(activeEntity).name : "your personal profile";

	if (loading) return <p className="text-misty-forest">Loading…</p>;
	if (!prefs) return <p className="text-sm text-red-600">{error || "Preferences unavailable."}</p>;

	return (
		<div className="space-y-4">
			<p className="text-sm text-misty-forest">
				Preferences for <span className="font-medium">{whose}</span>. Switch profiles to manage a page’s emails.
			</p>

			<div>
				<Toggle
					label="Email me about activity"
					description="Master switch — when off, nothing below is sent."
					checked={prefs.master}
					disabled={saving}
					onChange={(v) => {
						setPrefs({ ...prefs, master: v });
						save({ master: v });
					}}
				/>
				<div className={`mt-1 border-t border-ash-green py-3 ${FREQUENCY_COMING_SOON ? "opacity-50" : ""}`}>
					<div className="flex items-center gap-2">
						<p className="text-sm font-medium text-rich-brown">Email frequency</p>
						{FREQUENCY_COMING_SOON && (
							<span className="rounded-full bg-ash-green px-2 py-0.5 text-xs text-dusty-grey">Coming soon!</span>
						)}
					</div>
					<p className="text-xs text-misty-forest mb-2">How often you want to be notified of activity</p>
					<VisibilitySelector<Frequency>
						value={prefs.master ? "INSTANT" : "NEVER"}
						onChange={(next) => {
							// Never is the master switch turned off; the rest need digests that don't exist yet.
							if (next === "NEVER" || next === "INSTANT") {
								setPrefs({ ...prefs, master: next === "INSTANT" });
								save({ master: next === "INSTANT" });
							}
						}}
						options={FREQUENCY_OPTIONS}
						name="emailFrequency"
						legend="Email frequency"
						hideLegend
						disabled={FREQUENCY_COMING_SOON || saving}
					/>
				</div>
				<div className={`mt-1 divide-y divide-ash-green border-t border-ash-green pt-1 ${prefs.master ? "" : "opacity-50"}`}>
					{CATEGORY_ROWS.map((row) => (
						<Toggle
							key={row.key}
							label={row.label}
							description={row.description}
							checked={prefs.categories[row.key] ?? false}
							disabled={saving || !prefs.master}
							onChange={(v) => {
								setPrefs({ ...prefs, categories: { ...prefs.categories, [row.key]: v } });
								save({ categories: { [row.key]: v } });
							}}
						/>
					))}
				</div>
			</div>

			{error ? <p className="text-sm text-red-600">{error}</p> : null}
		</div>
	);
}
