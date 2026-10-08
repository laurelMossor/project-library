"use client";

import { useState } from "react";
import type { PermissionRole } from "@prisma/client";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { Button } from "@/lib/components/ui/Button";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { RoleSelector } from "./RoleSelector";
import { parseEmailList } from "@/lib/validations";
import { formatRole } from "@/lib/const/roles";
import { API_PAGE_EMAIL_INVITES } from "@/lib/const/routes";
import { EMAIL_INVITE_DAILY_CAP, EMAIL_INVITE_NOTE_MAX } from "@/lib/const/email-invites";

type EmailInviteModalProps = {
	pageId: string;
	pageName: string;
	/** Roles this page can offer (assignableRoles). The last one is the default pick. */
	roleChoices: readonly PermissionRole[];
	/** Prefill for the address field, e.g. an email typed into the member search. */
	initialEmails?: string;
	onClose: () => void;
	/** Called after the server accepts the batch: how many were invited, and who already had a role. */
	onSent: (result: { sent: number; alreadyMembers: string[] }) => void;
};

/**
 * Invite people to a page by email. Addresses that already have an account get the normal in-app
 * invite; the server never says which ones those were, and neither does this modal.
 */
export function EmailInviteModal({ pageId, pageName, roleChoices, initialEmails = "", onClose, onSent }: EmailInviteModalProps) {
	const [emailsText, setEmailsText] = useState(initialEmails);
	const [note, setNote] = useState("");
	const [role, setRole] = useState<PermissionRole>(roleChoices[roleChoices.length - 1]);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const { valid, invalid } = parseEmailList(emailsText);
	const trimmedNote = note.trim();
	const overCap = valid.length > EMAIL_INVITE_DAILY_CAP;
	const noteTooLong = trimmedNote.length > EMAIL_INVITE_NOTE_MAX;
	const canSend = valid.length > 0 && invalid.length === 0 && !overCap && !noteTooLong && !busy;

	async function send() {
		if (!canSend) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(API_PAGE_EMAIL_INVITES(pageId), {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ emails: valid, role, note: trimmedNote || null }),
			});
			const body = (await res.json().catch(() => ({}))) as {
				error?: string;
				sent?: number;
				alreadyMembers?: unknown;
			};
			if (!res.ok) {
				throw new Error(body.error ?? "Failed to send invites");
			}
			const alreadyMembers = Array.isArray(body.alreadyMembers)
				? body.alreadyMembers.filter((email): email is string => typeof email === "string")
				: [];
			onSent({
				sent: typeof body.sent === "number" ? body.sent : valid.length,
				alreadyMembers,
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Failed to send invites");
			setBusy(false);
		}
	}

	return (
		<ModalShell title="Invite via email" onClose={onClose} dismissible={!busy} widthClassName="max-w-md">
			<div className="space-y-4 text-sm text-warm-grey">
				<div className="flex items-center justify-between gap-3">
					<span className="text-rich-brown">Invite to {pageName} as</span>
					<RoleSelector current={role} roles={roleChoices} onChange={async (r) => setRole(r as PermissionRole)} />
				</div>

				<div className="space-y-1">
					<label htmlFor="email-invite-addresses" className="block font-medium text-rich-brown">
						Email addresses
					</label>
					<FormTextarea
						id="email-invite-addresses"
						rows={3}
						value={emailsText}
						onChange={(e) => setEmailsText(e.target.value)}
						placeholder="friend@example.com, neighbor@example.com"
						autoFocus
					/>
					<p className={`text-xs ${overCap ? "text-novel-red" : "text-dusty-grey"}`}>
						{valid.length} {valid.length === 1 ? "email" : "emails"} · up to {EMAIL_INVITE_DAILY_CAP} a day
					</p>
					{invalid.length > 0 && (
						<p className="text-xs text-novel-red">Not a valid address: {invalid.join(", ")}</p>
					)}
				</div>

				<div className="space-y-1">
					<label htmlFor="email-invite-note" className="block font-medium text-rich-brown">
						Note <span className="font-normal text-dusty-grey">(optional)</span>
					</label>
					<FormTextarea
						id="email-invite-note"
						rows={3}
						value={note}
						onChange={(e) => setNote(e.target.value)}
						placeholder="Say a little about why you're inviting them"
					/>
					<p className={`text-xs text-right ${noteTooLong ? "text-novel-red" : "text-dusty-grey"}`}>
						{trimmedNote.length}/{EMAIL_INVITE_NOTE_MAX}
					</p>
				</div>

				{valid.length > 0 && (
					<div className="rounded border border-soft-grey/60 bg-grey-white/60 p-3 text-xs text-dusty-grey space-y-1" aria-label="Invite preview">
						<p>
							Inviting {valid.length} {valid.length === 1 ? "person" : "people"} as {formatRole(role)}:{" "}
							<span className="text-rich-brown break-all">{valid.join(", ")}</span>
						</p>
						{trimmedNote && (
							<p className="whitespace-pre-wrap">
								Note: <span className="text-rich-brown">{trimmedNote}</span>
							</p>
						)}
					</div>
				)}

				{error && <p role="alert" className="text-sm text-novel-red">{error}</p>}
				<div className="flex justify-end gap-2 pt-1">
					<Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button loading={busy} disabled={!canSend} onClick={send}>Confirm</Button>
				</div>
			</div>
		</ModalShell>
	);
}
