"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import type { IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { AddressSection } from "@/lib/components/profile/AddressSection";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PageMembershipSettings } from "@/lib/components/profile/PageMembershipSettings";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { Button } from "@/lib/components/ui/Button";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_PAGES, PUBLIC_PROFILE, SETTINGS } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { PublicPage } from "@/lib/types/page";

const BLANK_PAGE = {
	id: "",
	name: "",
	handle: "",
	headline: null,
	bio: null,
	location: null,
	interests: [],
	addressLine1: null,
	addressLine2: null,
	city: null,
	state: null,
	zip: null,
	avatarImageId: null,
	avatarImage: null,
	profileVisibility: "PUBLIC",
	contentVisibility: "LISTED",
	membershipPolicy: "CLOSED",
	allowMemberPosts: false,
} as unknown as PublicPage;

/**
 * A page is a draft in this form's state until the person says "Looks good", and only
 * then is it created. Leaving the form discards it; nothing has been saved. It is the
 * setup form's sections on a blank page, plus membership, with a create for its save.
 */
export function PageCreateClient() {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [entity, setEntity] = useState<IdentityEntity>({ type: "page", data: BLANK_PAGE });

	async function create(payload: SavePayload) {
		const res = await fetch(API_PAGES, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			// A page left unnamed takes its handle as the name.
			body: JSON.stringify({ ...payload.fields, name: payload.fields.name || payload.fields.handle }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.error || "Failed to create page");
		// A failed switch is not a failed create. The page exists; open it either way.
		await switchProfile(body.id);
		router.push(PUBLIC_PROFILE(body.handle));
	}

	function merge(patch: Record<string, unknown>) {
		setEntity((prev) => ({ type: "page", data: { ...prev.data, ...patch } as PublicPage }));
	}

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Create a page</h1>
			<p className="text-sm text-gray-500 mb-8">
				Nothing is created until you say it looks good. Leave this screen and the draft is gone.
			</p>
			<InlineEditSession resource={entity.data as unknown as Record<string, unknown>} onSave={create} canEdit footer="none">
				<PageDraftFields entity={entity} merge={merge} />
			</InlineEditSession>
		</div>
	);
}

function PageDraftFields({
	entity,
	merge,
}: {
	entity: IdentityEntity;
	merge: (patch: Record<string, unknown>) => void;
}) {
	const session = useInlineEditSession();
	const page = entity.data as PublicPage;
	// The handle is the one required field, and it only enters the draft once it checks out.
	const hasHandle = !!session?.dirtyFields.handle;

	return (
		<div>
			<EditableIdentityBlock entity={entity} merge={merge} draft />

			<AboutFields
				headline={page.headline}
				bio={page.bio}
				location={page.location}
				interests={page.interests}
				bioPlaceholder="Describe this page"
			/>

			<VisibilityField
				profileSectionTitle="Page Visibility"
				contentSectionTitle="Content Visibility"
				initialProfileVisibility={page.profileVisibility ?? "PUBLIC"}
				initialContentVisibility={page.contentVisibility ?? "LISTED"}
			/>
			<PageMembershipSettings
				initialPolicy={page.membershipPolicy ?? "CLOSED"}
				initialAllowMemberPosts={page.allowMemberPosts ?? false}
			/>

			<AddressSection page={page} />

			{session?.error && <p role="alert" className="text-sm text-novel-red mb-4">{session.error}</p>}
			<div className="flex gap-3">
				<Button onClick={() => session?.saveAll()} loading={session?.saving} disabled={!hasHandle}>
					Looks good
				</Button>
				<ButtonLink href={SETTINGS} variant="secondary">Cancel</ButtonLink>
			</div>
		</div>
	);
}
