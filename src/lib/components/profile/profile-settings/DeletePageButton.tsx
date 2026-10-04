"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { ConfirmModal } from "@/lib/components/ui/ConfirmModal";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { API_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";

export function DeletePageButton({ pageId, pageName }: { pageId: string; pageName: string }) {
	const router = useRouter();
	const { currentUser, switchProfile } = useActiveProfile();
	const [open, setOpen] = useState(false);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

	async function confirm() {
		setBusy(true);
		setError(null);
		try {
			const res = await fetch(API_PAGE(pageId), { method: "DELETE" });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Couldn't delete the page");
			}
			await switchProfile(null);
			if (currentUser?.handle) router.push(PUBLIC_PROFILE(currentUser.handle));
			else router.refresh();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't delete the page");
			setBusy(false);
		}
	}

	return (
		<>
			<Button variant="danger-outline" fullWidth onClick={() => { setError(null); setOpen(true); }}>Delete Page</Button>
			{open && (
				<ConfirmModal
					title={`Delete ${pageName}`}
					confirmLabel="Delete page"
					busy={busy}
					error={error}
					onConfirm={confirm}
					onClose={() => { if (!busy) setOpen(false); }}
				>
					<p>Are you sure? This action cannot be undone.</p>
					<p>The page, its posts, and its events are deleted. Messages and comments sent as the page stay as placeholders.</p>
				</ConfirmModal>
			)}
		</>
	);
}
