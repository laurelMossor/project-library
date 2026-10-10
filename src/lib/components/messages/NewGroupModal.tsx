"use client";

import { useState } from "react";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { Button } from "@/lib/components/ui/Button";
import { useAction } from "@/lib/hooks/useAction";
import { createGroupAction } from "@/lib/actions/message";
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
	const [localError, setLocalError] = useState<string | null>(null);
	const { run, pending, error: actionError, clearError } = useAction(createGroupAction);
	const error = localError ?? actionError;

	async function create() {
		setLocalError(null);
		clearError();
		// Blank (or only spaces) = unnamed group — the field is optional.
		const nameValue = name.trim() || null;
		const nameCheck = validateGroupName(nameValue);
		if (!nameCheck.valid) { setLocalError(nameCheck.error!); return; }
		if (members.length === 0) { setLocalError("Add at least one member"); return; }

		const result = await run({ members: members.map(toRef), name: nameValue, asPageId });
		if (result.ok) onCreated(result.data);
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
						<Button size="sm" onClick={create} loading={pending} disabled={members.length === 0}>Create group</Button>
					</div>
				</div>
			</div>
		</ModalShell>
	);
}

