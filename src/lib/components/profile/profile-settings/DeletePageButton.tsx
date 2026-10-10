"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/lib/components/ui/Button";
import { ConfirmModal } from "@/lib/components/ui/ConfirmModal";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { useAction } from "@/lib/hooks/useAction";
import { deletePageAction } from "@/lib/actions/page";
import { SETTINGS } from "@/lib/const/routes";

export function DeletePageButton({ pageId, pageName }: { pageId: string; pageName: string }) {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [open, setOpen] = useState(false);
	const { run, pending, error, clearError } = useAction(deletePageAction);
	const [leaving, setLeaving] = useState(false);
	const busy = pending || leaving;

	async function confirm() {
		const result = await run({ id: pageId });
		if (!result.ok) return;
		setLeaving(true); // stay busy until the navigation lands
		// The page is gone, so stop acting as it. The switch refreshes server data as the personal profile.
		await switchProfile(null);
		router.push(SETTINGS);
	}

	return (
		<>
			<Button variant="danger-outline" fullWidth onClick={() => { clearError(); setOpen(true); }}>Delete Page</Button>
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
