"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { Button } from "@/lib/components/ui/Button";
import { ConfirmModal } from "@/lib/components/ui/ConfirmModal";
import { API_ME_USER, API_ME_USER_DELETE_PREVIEW, HOME } from "@/lib/const/routes";

type PreviewPage = { id: string; name: string; handle: string };

export function DeleteAccountButton() {
	const [open, setOpen] = useState(false);
	const [pages, setPages] = useState<PreviewPage[] | null>(null);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function loadPreview() {
		const res = await fetch(API_ME_USER_DELETE_PREVIEW);
		const data = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(data.error || "Couldn't load what would be deleted");
		setPages(data.pages ?? []);
		return (data.pages ?? []) as PreviewPage[];
	}

	async function openModal() {
		setError(null);
		setPages(null);
		setOpen(true);
		try {
			await loadPreview();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't load what would be deleted");
		}
	}

	async function confirm() {
		if (!pages) return;
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(API_ME_USER, {
				method: "DELETE",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ expectedPageIds: pages.map((page) => page.id) }),
			});
			if (res.status === 409) {
				setError("That list changed. Review it and confirm again.");
				await loadPreview();
				return;
			}
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Couldn't delete the account");
			}
			await signOut({ callbackUrl: HOME });
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't delete the account");
		} finally {
			setBusy(false);
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
