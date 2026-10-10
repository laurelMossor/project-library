"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/lib/components/ui/Button";
import { ConfirmModal } from "@/lib/components/ui/ConfirmModal";
import { API_ME_USER_DELETE_PREVIEW, HOME } from "@/lib/const/routes";
import { useAction } from "@/lib/hooks/useAction";
import { deleteAccountAction } from "@/lib/actions/account";

type PreviewPage = { id: string; name: string; handle: string };

export function DeleteAccountButton() {
	const [open, setOpen] = useState(false);
	const [pages, setPages] = useState<PreviewPage[] | null>(null);
	const { run, pending, error: actionError, clearError } = useAction(deleteAccountAction);
	const [signingOut, setSigningOut] = useState(false);
	const [previewError, setPreviewError] = useState<string | null>(null);
	const busy = pending || signingOut;
	// A conflict shows the "list changed" note rather than the raw action message.
	const error = previewError ?? actionError;

	async function loadPreview() {
		const res = await fetch(API_ME_USER_DELETE_PREVIEW);
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || "Couldn't load what would be deleted");
		setPages(data.pages ?? []);
		return (data.pages ?? []) as PreviewPage[];
	}

	async function openModal() {
		setPreviewError(null);
		clearError();
		setPages(null);
		setOpen(true);
		try {
			await loadPreview();
		} catch (e) {
			setPreviewError(e instanceof Error ? e.message : "Couldn't load what would be deleted");
		}
	}

	async function confirm() {
		if (!pages) return;
		setPreviewError(null);
		clearError();
		const result = await run({ expectedPageIds: pages.map((page) => page.id) });
		if (result.ok) {
			// Stay busy through the sign-out redirect.
			setSigningOut(true);
			await signOut({ callbackUrl: HOME });
			return;
		}
		if (result.error === "conflict") {
			// The sole-admin list changed under us: show the fresh one and ask again.
			setPreviewError("That list changed. Review it and confirm again.");
			try {
				await loadPreview();
			} catch (e) {
				setPreviewError(e instanceof Error ? e.message : "Couldn't load what would be deleted");
			}
		}
	}

	return (
		<>
			<Button variant="danger-outline" fullWidth onClick={openModal}>Delete Account</Button>
			{open && (
				<ConfirmModal
					title="Delete account"
					confirmLabel="Delete account"
					busy={busy}
					error={error}
					onConfirm={confirm}
					onClose={() => { if (!busy) setOpen(false); }}
				>
					<p>Are you sure? This action cannot be undone.</p>
					<p>Your posts are deleted, including posts you wrote on pages. Your messages, comments, and RSVPs stay as placeholders that no longer name you.</p>
					{pages === null ? (
						<p>Checking pages you admin…</p>
					) : pages.length > 0 ? (
						<div>
							<p className="mb-2">These pages will also be deleted, because you are the only admin:</p>
							<ul className="list-disc pl-5">
								{pages.map((page) => (
									<li key={page.id}>{page.name} (@{page.handle})</li>
								))}
							</ul>
						</div>
					) : (
						<p>Pages you share with another admin will stay, and the next admin will take them over.</p>
					)}
				</ConfirmModal>
			)}
		</>
	);
}
