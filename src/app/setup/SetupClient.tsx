"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { HandleEditor } from "@/lib/components/profile/HandleEditor";
import { InlineTextField } from "@/lib/components/profile/InlineTextField";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { PageMembershipSettings } from "@/lib/components/profile/PageMembershipSettings";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
import { Button } from "@/lib/components/ui/Button";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_PAGE_HANDLE, API_ME_SETUP_COMPLETE, EXPLORE_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";
import type { CardEntity } from "@/lib/types/card";
import type { IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";

export function SetupClient({ next }: { next: string }) {
	const { activePageId } = useActiveProfile();

	return (
		<div className="mx-auto w-full max-w-lg px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Review your settings</h1>
			<p className="text-sm text-gray-500 mb-8">
				These are already saved. Change anything you want, or keep them as they are.
			</p>
			<ActiveIdentityEditor footer="none">
				{(entity, { merge }) => (
					<SetupFields entity={entity} merge={merge} next={next} isPage={!!activePageId} />
				)}
			</ActiveIdentityEditor>
			<div className="mt-8">
				<NotificationSettingsForm />
			</div>
		</div>
	);
}

function SetupFields({
	entity,
	merge,
	next,
	isPage,
}: {
	entity: IdentityEntity;
	merge: (patch: Record<string, unknown>) => void;
	next: string;
	isPage: boolean;
}) {
	const session = useInlineEditSession();
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [handle, setHandle] = useState(entity.data.handle);
	const card: CardEntity = entity.type === "page"
		? {
			id: entity.data.id,
			name: entity.data.name,
			handle: entity.data.handle,
			avatarImageId: entity.data.avatarImageId,
			avatarImage: entity.data.avatarImage,
		}
		: {
			id: entity.data.id,
			handle: entity.data.handle,
			displayName: entity.data.displayName,
			avatarImageId: entity.data.avatarImageId,
			avatarImage: entity.data.avatarImage,
		};

	async function looksGood() {
		setBusy(true);
		setError(null);
		try {
			await session?.saveAll();
			if (isPage) {
				router.push(PUBLIC_PROFILE(handle));
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

	return (
		<div className="space-y-6">
			<ClickableProfilePicture
				entity={card}
				canEdit
				onSaved={(avatar) => merge({
					avatarImageId: avatar?.id ?? null,
					avatarImage: avatar ? { url: avatar.url } : null,
				})}
			/>
			<HandleEditor
				initialHandle={entity.data.handle}
				endpoint={isPage ? API_ME_PAGE_HANDLE : undefined}
				highlight
				onSaved={setHandle}
			/>
			{entity.type === "user" ? (
				<InlineTextField name="displayName" label="Display Name" original={entity.data.displayName} placeholder="Add a display name" isPublic />
			) : (
				<InlineTextField name="name" label="Page Name" original={entity.data.name} placeholder="Page name" isPublic />
			)}
			<VisibilityField
				profileSectionTitle={entity.type === "page" ? "Page Visibility" : "Profile Visibility"}
				contentSectionTitle="Content Visibility"
				initialProfileVisibility={entity.data.profileVisibility ?? "PUBLIC"}
				initialContentVisibility={entity.data.contentVisibility ?? "LISTED"}
			/>
			{entity.type === "page" && (
				<PageMembershipSettings
					initialPolicy={entity.data.membershipPolicy ?? "CLOSED"}
					initialAllowMemberPosts={entity.data.allowMemberPosts ?? false}
				/>
			)}
			{error && <p role="alert" className="text-sm text-novel-red">{error}</p>}
			<Button onClick={looksGood} loading={busy}>Looks good</Button>
		</div>
	);
}
