"use client";

import { useState } from "react";
import { signOut } from "next-auth/react";
import { ActiveIdentityEditor, type IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PersonalInfoSection } from "@/lib/components/profile/PersonalInfoSection";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { Button } from "@/lib/components/ui/Button";
import { ConfirmModal } from "@/lib/components/ui/ConfirmModal";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { API_ME_SETUP, API_ME_SETUP_COMPLETE, EXPLORE_PAGE, PUBLIC_PROFILE, WELCOME_PAGE } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";

/**
 * The review a new account gets after verifying its email. The account already exists
 * and stays if you leave. Deleting it is an explicit action, and only works until
 * setup is finished. Pages are a separate screen.
 */
export function SetupClient({ next }: { next: string }) {
	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Set up your account</h1>
			<p className="text-sm text-gray-500 mb-8">
				Here is what you picked at signup. Leaving keeps this account. You can delete it if you do not want it.
			</p>
			<ActiveIdentityEditor footer="none">
				{(entity, { merge }) =>
					entity.type === "user"
						? <SetupFields entity={entity} merge={merge} next={next} />
						: null
				}
			</ActiveIdentityEditor>
		</div>
	);
}

function SetupFields({
	entity,
	merge,
	next,
}: {
	entity: Extract<IdentityEntity, { type: "user" }>;
	merge: (patch: Record<string, unknown>) => void;
	next: string;
}) {
	const user = entity.data;
	const session = useInlineEditSession();
	const { value: handle } = useInlineField<string>("handle", user.handle);
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [confirmingDelete, setConfirmingDelete] = useState(false);
	const [deleting, setDeleting] = useState(false);
	const [deleteError, setDeleteError] = useState<string | null>(null);

	async function looksGood() {
		setBusy(true);
		setError(null);
		try {
			// A failed save stays here with its message; setup is only marked done once everything saved.
			if (!(await session?.saveAll())) {
				setBusy(false);
				return;
			}
			const res = await fetch(API_ME_SETUP_COMPLETE, { method: "POST" });
			if (!res.ok) throw new Error("Couldn't finish setup");
			// Full load, same reason as LeaveSetup: a client navigation would keep the
			// layout that still has needsSetup and bounce right back to this page.
			const generic = !next || next === "/" || next === WELCOME_PAGE || next === EXPLORE_PAGE;
			window.location.assign(generic ? PUBLIC_PROFILE(handle || user.handle) : next);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't finish setup");
			setBusy(false);
		}
	}

	async function confirmDelete() {
		setDeleting(true);
		setDeleteError(null);
		try {
			const res = await fetch(API_ME_SETUP, { method: "DELETE" });
			const data = await res.json().catch(() => ({}));
			if (!res.ok) throw new Error(data.error || "Couldn't delete this account");
			await signOut({ redirect: false });
			window.location.assign(WELCOME_PAGE);
		} catch (e) {
			setDeleteError(e instanceof Error ? e.message : "Couldn't delete this account");
			setDeleting(false);
		}
	}

	const shownError = error ?? session?.error;

	return (
		<div>
			<EditableIdentityBlock entity={entity} merge={merge} followHandle />

			<AboutFields
				headline={user.headline}
				bio={user.bio}
				location={user.location}
				interests={user.interests}
				bioPlaceholder="Tell people about yourself"
			/>

			<VisibilityField
				profileSectionTitle="Profile Visibility"
				contentSectionTitle="Content Visibility"
				initialProfileVisibility={user.profileVisibility ?? "PUBLIC"}
				initialContentVisibility={user.contentVisibility ?? "LISTED"}
			/>

			<PersonalInfoSection user={user as PublicUser & { email?: string }} />

			{shownError && <p role="alert" className="text-sm text-novel-red mb-4">{shownError}</p>}
			<div className="flex gap-3">
				<Button onClick={looksGood} loading={busy} disabled={confirmingDelete}>Looks good</Button>
				<Button type="button" variant="secondary" disabled={busy} onClick={() => { setDeleteError(null); setConfirmingDelete(true); }}>
					Delete this account
				</Button>
			</div>

			{confirmingDelete && (
				<ConfirmModal
					title="Delete this account"
					confirmLabel="Delete this account"
					busy={deleting}
					error={deleteError}
					onConfirm={confirmDelete}
					onClose={() => { if (!deleting) setConfirmingDelete(false); }}
				>
					<p>This permanently deletes the account you just created. This cannot be undone.</p>
				</ConfirmModal>
			)}
		</div>
	);
}
