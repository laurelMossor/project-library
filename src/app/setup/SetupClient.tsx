"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveIdentityEditor, type IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PersonalInfoSection } from "@/lib/components/profile/PersonalInfoSection";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
import { Button } from "@/lib/components/ui/Button";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_SETUP_COMPLETE, EXPLORE_PAGE } from "@/lib/const/routes";
import type { PublicUser } from "@/lib/types/user";

/**
 * The review a new account gets after verifying its email. The handle and name were
 * picked at signup, so they arrive filled in. Pages never come through here: they are
 * built in /pages/new and only created once the person confirms.
 */
export function SetupClient({ next }: { next: string }) {
	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Set up your account</h1>
			<p className="text-sm text-gray-500 mb-8">
				Here is what you picked at signup. Change anything, add the rest, then say it looks good.
			</p>
			<ActiveIdentityEditor footer="none">
				{(entity, { merge }) =>
					entity.type === "user" ? <SetupFields entity={entity} merge={merge} next={next} /> : null
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
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);

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
			router.refresh();
			router.replace(next || EXPLORE_PAGE);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't finish setup");
			setBusy(false);
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

			<SettingsSection title="Email notifications">
				<NotificationSettingsForm />
			</SettingsSection>

			<PersonalInfoSection user={user as PublicUser & { email?: string }} />

			{shownError && <p role="alert" className="text-sm text-novel-red mb-4">{shownError}</p>}
			<Button onClick={looksGood} loading={busy}>Looks good</Button>
		</div>
	);
}
