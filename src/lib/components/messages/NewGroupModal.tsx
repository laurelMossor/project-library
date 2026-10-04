"use client";

import { useState } from "react";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { Button } from "@/lib/components/ui/Button";
import { API_CONVERSATIONS } from "@/lib/const/routes";
import { MAX_GROUP_PARTICIPANTS } from "@/lib/const/messaging";
import { validateGroupName } from "@/lib/validations";
import type { SearchResultItem } from "@/lib/types/search";
import { MemberPicker, toRef } from "./MemberPicker";
import { GroupNameInput } from "./GroupNameInput";

type Props = {
	/** The acting identity creates (and is always in) the group. */
	actingKey: string;
	asPageId: string | null;
	actingName: string;
	onClose: () => void;
	onCreated: (conversationId: string) => void;
};

/** Start a group as the active identity: pick members, optionally name it. */
export function NewGroupModal({ actingKey, asPageId, actingName, onClose, onCreated }: Props) {
	const [members, setMembers] = useState<SearchResultItem[]>([]);
	const [name, setName] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);

	async function create() {
		setError(null);
		// Blank (or only spaces) = unnamed group — the field is optional.
		const nameValue = name.trim() || null;
		const nameCheck = validateGroupName(nameValue);
		if (!nameCheck.valid) { setError(nameCheck.error!); return; }
		if (members.length === 0) { setError("Add at least one member"); return; }

		setSaving(true);
		try {
			const res = await fetch(API_CONVERSATIONS, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ members: members.map(toRef), name: nameValue, asPageId }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setError(data.error || "Couldn't create the group"); return; }
			onCreated(data.conversationId);
		} catch {
			setError("Couldn't create the group");
		} finally {
			setSaving(false);
		}
	}

	return (
		<ModalShell title="New group" onClose={onClose} widthClassName="max-w-md">
			<div className="flex flex-col gap-4">
				<p className="text-sm text-misty-forest">
					Starting as <span className="font-semibold text-rich-brown">{actingName}</span>. Everyone you add sees
					messages sent from now on.
				</p>
				<GroupNameInput value={name} onChange={setName} />
				<MemberPicker
					asPageId={asPageId}
					selected={members}
					onChange={setMembers}
					excludeKeys={new Set([actingKey])}
					remaining={MAX_GROUP_PARTICIPANTS - 1 - members.length}
				/>
				{error && <p role="alert" className="text-sm text-novel-red">{error}</p>}
				<div className="flex items-center justify-between gap-3 pt-1">
					<span className="text-xs text-dusty-grey">{members.length + 1} / {MAX_GROUP_PARTICIPANTS} members</span>
					<div className="flex gap-2">
						<Button variant="secondary" size="sm" onClick={onClose}>Cancel</Button>
						<Button size="sm" onClick={create} loading={saving} disabled={members.length === 0}>Create group</Button>
					</div>
				</div>
			</div>
		</ModalShell>
	);
}

