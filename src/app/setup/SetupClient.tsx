"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { HandleEditor } from "@/lib/components/profile/HandleEditor";
import { InlineTextField } from "@/lib/components/profile/InlineTextField";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";
import { SetupNameField } from "@/lib/components/profile/SetupNameField";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
import { Button } from "@/lib/components/ui/Button";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_SETUP_COMPLETE, EXPLORE_PAGE } from "@/lib/const/routes";
import type { CardEntity } from "@/lib/types/card";
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
					entity.type === "user" ? <SetupFields user={entity.data} merge={merge} next={next} /> : null
				}
			</ActiveIdentityEditor>
		</div>
	);
}

function SetupFields({
	user,
	merge,
	next,
}: {
	user: PublicUser;
	merge: (patch: Record<string, unknown>) => void;
	next: string;
}) {
	const session = useInlineEditSession();
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [handle, setHandle] = useState(user.handle);
	const card: CardEntity = {
		id: user.id,
		handle: user.handle,
		displayName: user.displayName,
		avatarImageId: user.avatarImageId,
		avatarImage: user.avatarImage,
	};
	const email = (user as PublicUser & { email?: string }).email;

	async function looksGood() {
		setBusy(true);
		setError(null);
		try {
			await session?.saveAll();
			const res = await fetch(API_ME_SETUP_COMPLETE, { method: "POST" });
			if (!res.ok) throw new Error("Couldn't finish setup");
			router.refresh();
			router.replace(next || EXPLORE_PAGE);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't finish setup");
			setBusy(false);
		}
	}

	return (
		<div>
			<div className="space-y-4 mb-6">
				<HandleEditor initialHandle={user.handle} highlight onSaved={setHandle} />
				<SetupNameField name="displayName" label="Display Name" stored={user.displayName} handle={handle} />
			</div>

			<SettingsSection title="Profile photo">
				<ClickableProfilePicture
					entity={card}
					canEdit
					onSaved={(avatar) => merge({
						avatarImageId: avatar?.id ?? null,
						avatarImage: avatar ? { url: avatar.url } : null,
					})}
				/>
			</SettingsSection>

			<SettingsSection title="Personal information">
				{email && (
					<div className="mb-4">
						<FieldLabel label="Email" />
						<p className="text-base text-warm-grey mt-1">{email}</p>
					</div>
				)}
				<div className="space-y-4">
					<InlineTextField name="firstName" label="First Name" original={user.firstName} placeholder="Add first name" />
					<InlineTextField name="middleName" label="Middle Name" original={user.middleName} placeholder="Add middle name" />
					<InlineTextField name="lastName" label="Last Name" original={user.lastName} placeholder="Add last name" />
				</div>
			</SettingsSection>

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

			{error && <p role="alert" className="text-sm text-novel-red mb-4">{error}</p>}
			<Button onClick={looksGood} loading={busy}>Looks good</Button>
		</div>
	);
}
