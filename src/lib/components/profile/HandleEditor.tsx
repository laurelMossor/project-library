"use client";

import { useState } from "react";
import { authFetch } from "@/lib/utils/auth-client";
import { API_ME_HANDLE } from "@/lib/const/routes";
import { FieldLabel } from "./FieldLabel";

/**
 * Handle changes save through their own endpoint, not the inline-edit batch,
 * because they must also update the cross-entity Handle namespace row.
 */
export function HandleEditor({
	initialHandle,
	endpoint = API_ME_HANDLE,
	highlight = false,
	onSaved,
}: {
	initialHandle: string;
	endpoint?: string;
	/** Accent outline used on the setup review, where the handle is the thing to notice. */
	highlight?: boolean;
	onSaved?: (handle: string) => void;
}) {
	const [handle, setHandle] = useState(initialHandle);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(initialHandle);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const start = () => { setDraft(handle); setError(null); setEditing(true); };
	const cancel = () => { setEditing(false); setError(null); };

	const save = async () => {
		const next = draft.trim().toLowerCase();
		if (next === handle) { setEditing(false); return; }
		setSaving(true);
		setError(null);
		try {
			const res = await authFetch(endpoint, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ handle: next }),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(body.error || "Failed to update handle");
			const saved = body.handle ?? next;
			setHandle(saved);
			setEditing(false);
			onSaved?.(saved);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to update handle");
		} finally {
			setSaving(false);
		}
	};

	const previewHandle = draft.trim().toLowerCase() || handle;

	return (
		<div className={highlight ? "rounded-md ring-2 ring-rich-brown p-3" : undefined}>
			<FieldLabel label="Handle" isPublic />
			{editing ? (
				<div className="mt-1 space-y-2">
					<div className="flex items-center gap-1">
						<span className="text-base text-dusty-grey">@</span>
						<input
							type="text"
							value={draft}
							onChange={(e) => setDraft(e.target.value)}
							maxLength={30}
							autoFocus
							className="flex-1 text-base border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent"
						/>
					</div>
					<p className="text-xs text-dusty-grey">/{previewHandle}</p>
					<p className="text-xs text-dusty-grey">Changing it breaks existing links.</p>
					{error && <p className="text-xs text-red-500">{error}</p>}
					<div className="flex gap-2">
						<button
							onClick={save}
							disabled={saving}
							className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-misty-forest hover:text-misty-forest transition-colors disabled:opacity-40 cursor-pointer"
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							onClick={cancel}
							disabled={saving}
							className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-red-300 hover:text-red-500 transition-colors disabled:opacity-40 cursor-pointer"
						>
							Cancel
						</button>
					</div>
				</div>
			) : (
				<div className="mt-1">
					<div className="flex items-center justify-between gap-3">
						<p className="text-base">@{handle}</p>
						<button
							onClick={start}
							className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:border-misty-forest hover:text-misty-forest transition-colors cursor-pointer shrink-0"
						>
							Change
						</button>
					</div>
					<p className="text-xs text-dusty-grey mt-1">/{handle}</p>
				</div>
			)}
		</div>
	);
}
