"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import type { IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import { AboutFields } from "@/lib/components/profile/AboutFields";
import { AddressSection } from "@/lib/components/profile/AddressSection";
import { EditableIdentityBlock } from "@/lib/components/profile/EditableIdentityBlock";
import { PageMembershipSettings } from "@/lib/components/profile/PageMembershipSettings";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { Button } from "@/lib/components/ui/Button";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_PAGES, PUBLIC_PROFILE, SETTINGS } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { PublicPage } from "@/lib/types/page";
import { nameOrHandle } from "@/lib/utils/identity-name";

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
 * Nothing is written until Looks good. The id is chosen up front so the generated
 * avatar preview is the one the created page keeps. Notification settings are set
 * later, from Settings, once the page exists.
 */
export function PageCreateClient({ id }: { id: string }) {
	const router = useRouter();
	const [entity, setEntity] = useState<IdentityEntity>({
		type: "page",
		data: { ...BLANK_PAGE, id },
	});

	async function save(payload: SavePayload) {
		const fields = { ...payload.fields };
		const handle = typeof fields.handle === "string" ? fields.handle : "";
		const name = nameOrHandle(typeof fields.name === "string" ? fields.name : null, handle);
		const res = await fetch(API_PAGES, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...fields, id: entity.data.id, name, handle }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.error || "Failed to create page");
		router.push(PUBLIC_PROFILE(body.handle ?? handle));
		return body;
	}

	function merge(patch: Record<string, unknown>) {
		setEntity((prev) => ({ type: "page", data: { ...prev.data, ...patch } as PublicPage }));
	}

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Create a page</h1>
			<p className="text-sm text-gray-500 mb-8">
				Nothing is created until you say it looks good. Cancel leaves without a page.
			</p>
			<InlineEditSession resource={entity.data as unknown as Record<string, unknown>} onSave={save} canEdit footer="none">
				<PageDraftFields entity={entity} merge={merge} onCancel={() => router.push(SETTINGS)} />
			</InlineEditSession>
		</div>
	);
}

function PageDraftFields({
	entity,
	merge,
	onCancel,
}: {
	entity: IdentityEntity;
	merge: (patch: Record<string, unknown>) => void;
	onCancel: () => void;
}) {
	const session = useInlineEditSession();
	const page = entity.data as PublicPage;
	const hasHandle = typeof session?.dirtyFields.handle === "string" && !!session.dirtyFields.handle;

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
				<Button type="button" variant="secondary" onClick={onCancel}>Cancel</Button>
			</div>
		</div>
	);
}
