"use client";

import { useState } from "react";
import { VisibilitySelector } from "./VisibilitySelector";
import type { Visibility } from "@/lib/types/user";

type Props = {
	initialVisibility: Visibility;
	/** PUT endpoint — /api/me/user or /api/me/page */
	saveUrl: string;
};

export function VisibilitySettings({ initialVisibility, saveUrl }: Props) {
	const [visibility, setVisibility] = useState<Visibility>(initialVisibility);
	const [saving, setSaving] = useState(false);
	const [savedAt, setSavedAt] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

	async function handleChange(v: Visibility) {
		setVisibility(v);
		setSaving(true);
		setError(null);
		try {
			const res = await fetch(saveUrl, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ fields: { visibility: v } }),
			});
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to save");
			}
			setSavedAt(Date.now());
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div className="space-y-2">
			<VisibilitySelector value={visibility} onChange={handleChange} disabled={saving} />
			{saving && <p className="text-xs text-dusty-grey">Saving…</p>}
			{savedAt && !saving && !error && <p className="text-xs text-moss-green">Saved</p>}
			{error && <p className="text-xs text-red-500">{error}</p>}
		</div>
	);
}
