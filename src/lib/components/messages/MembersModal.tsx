"use client";

import { useState } from "react";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { Button } from "@/lib/components/ui/Button";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { API_CONVERSATION, API_CONVERSATION_LEAVE } from "@/lib/const/routes";
import { MAX_GROUP_PARTICIPANTS, identityKey } from "@/lib/const/messaging";
import { validateGroupName } from "@/lib/validations";
import type { ConversationThreadData } from "@/lib/types/message";
import type { SearchResultItem } from "@/lib/types/search";
import { fullName, memberEntity } from "./conversation-display";
import { MemberPicker, toRef } from "./MemberPicker";
import { GroupNameInput } from "./GroupNameInput";

type Props = {
	thread: ConversationThreadData;
	asPageId: string | null;
	onClose: () => void;
	/** Refetch the thread after a rename/add. */
	onChanged: () => void;
	/** The acting identity left the group. */
	onLeft: () => void;
};

/**
 * Group members panel: who's here (pages show as the page — never their managers), rename, add, leave.
 * Any member may rename or add; leaving as a page is ADMIN-only (`thread.canLeave`).
 */
export function MembersModal({ thread, asPageId, onClose, onChanged, onLeft }: Props) {
	const [name, setName] = useState(thread.name ?? "");
	const [adding, setAdding] = useState<SearchResultItem[]>([]);
	const [error, setError] = useState<string | null>(null);
	const [busy, setBusy] = useState<"save" | "leave" | null>(null);
	const [confirmLeave, setConfirmLeave] = useState(false);

	const nameChanged = (name.trim() || null) !== (thread.name ?? null);
	const dirty = nameChanged || adding.length > 0;

	async function save() {
		setError(null);
		const nameValue = name.trim() || null;
		if (nameChanged) {
			const check = validateGroupName(nameValue);
			if (!check.valid) { setError(check.error!); return; }
		}
		setBusy("save");
		try {
			const body: Record<string, unknown> = { asPageId };
			if (nameChanged) body.name = nameValue;
			if (adding.length) body.addMembers = adding.map(toRef);
			const res = await fetch(API_CONVERSATION(thread.id), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(body),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setError(data.error || "Couldn't save changes"); return; }
			setAdding([]);
			onChanged();
		} catch {
			setError("Couldn't save changes");
		} finally {
			setBusy(null);
		}
	}

	async function leave() {
		setError(null);
		setBusy("leave");
		try {
			const res = await fetch(API_CONVERSATION_LEAVE(thread.id), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ asPageId }),
			});
			const data = await res.json().catch(() => ({}));
			if (!res.ok) { setError(data.error || "Couldn't leave the group"); return; }
			onLeft();
		} catch {
			setError("Couldn't leave the group");
		} finally {
			setBusy(null);
		}
	}

	const you = thread.members.find((m) => m.isYou);

	return (
		<ModalShell title="Group members" onClose={onClose} widthClassName="max-w-md">
			<div className="flex flex-col gap-5">
				<GroupNameInput value={name} onChange={setName} />

				<section>
					<p className="text-[11px] uppercase tracking-wider text-dusty-grey mb-1">
						{thread.members.length} / {MAX_GROUP_PARTICIPANTS} members
					</p>
					<ul className="max-h-48 overflow-y-auto divide-y divide-soft-grey/60">
						{thread.members.map((m) => {
							const entity = memberEntity(m);
							return (
								<li key={identityKey(m)} className="flex items-center gap-3 py-2">
									{entity ? <ProfilePicture entity={entity} size="sm" /> : <div className="w-8 h-8 rounded-full bg-soft-grey" />}
									<span className="text-sm text-rich-brown truncate">{fullName(m)}</span>
									{m.type === "page" && <span className="text-[10px] uppercase tracking-wider text-dusty-grey">page</span>}
									{m.isYou && <span className="ml-auto text-xs rounded-full bg-melon-green px-2 py-0.5 text-rich-brown">you</span>}
								</li>
							);
						})}
					</ul>
				</section>

				<section>
					<p className="text-[11px] uppercase tracking-wider text-dusty-grey mb-2">Add people</p>
					<MemberPicker
						asPageId={asPageId}
						selected={adding}
						onChange={setAdding}
						excludeKeys={new Set(thread.members.map(identityKey))}
						remaining={MAX_GROUP_PARTICIPANTS - thread.members.length - adding.length}
					/>
				</section>

				{error && <p role="alert" className="text-sm text-novel-red">{error}</p>}

				<div className="flex items-center justify-between gap-3 border-t border-soft-grey pt-4">
					{thread.canLeave ? (
						confirmLeave ? (
							<span className="flex items-center gap-2 text-sm">
								<span className="text-rich-brown">Leave this group?</span>
								<Button variant="danger" size="sm" onClick={leave} loading={busy === "leave"}>Leave</Button>
								<Button variant="tertiary" size="sm" onClick={() => setConfirmLeave(false)}>Cancel</Button>
							</span>
						) : (
							<Button variant="tertiary" size="sm" className="!text-novel-red" onClick={() => setConfirmLeave(true)}>
								Leave group
							</Button>
						)
					) : (
						<span className="text-xs text-dusty-grey max-w-[14rem]">
							{you?.type === "page" ? "Only a page admin can remove the page from a group." : ""}
						</span>
					)}
					<Button size="sm" onClick={save} disabled={!dirty} loading={busy === "save"}>Save</Button>
				</div>
			</div>
		</ModalShell>
	);
}
