"use client";

import { useEffect, useRef, useState } from "react";
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
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_PAGES, API_PAGE, PUBLIC_PROFILE, SETTINGS } from "@/lib/const/routes";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
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
 * The page row is created when this screen opens, the same way a new post gets an id
 * immediately, so notification preferences can save against it. Cancel deletes that row.
 */
export function PageCreateClient() {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [entity, setEntity] = useState<IdentityEntity>({ type: "page", data: BLANK_PAGE });
	const [error, setError] = useState("");
	const started = useRef(false);

	useEffect(() => {
		if (started.current) return;
		started.current = true;
		(async () => {
			const res = await fetch(API_PAGES, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name: "New page" }),
			});
			const body = await res.json().catch(() => ({}));
			if (!res.ok) {
				setError(body.error || "Failed to create page");
				return;
			}
			setEntity({ type: "page", data: body as PublicPage });
			await switchProfile(body.id);
		})();
	}, [switchProfile]);

	async function save(payload: SavePayload) {
		const fields = { ...payload.fields };
		if (!fields.name) fields.name = fields.handle;
		const res = await fetch(API_PAGE(entity.data.id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...payload, fields }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.error || "Failed to save page");
		router.push(PUBLIC_PROFILE(body.handle ?? entity.data.handle));
		return body;
	}

	async function cancel() {
		if (entity.data.id) {
			await fetch(API_PAGE(entity.data.id), { method: "DELETE" });
		}
		router.push(SETTINGS);
	}

	if (!entity.data.id) {
		return (
			<div className="mx-auto w-full max-w-2xl px-4 py-10">
				{error ? <p className="text-sm text-novel-red">{error}</p> : <p className="text-sm text-gray-500">Creating your page...</p>}
			</div>
		);
	}

	function merge(patch: Record<string, unknown>) {
		setEntity((prev) => ({ type: "page", data: { ...prev.data, ...patch } as PublicPage }));
	}

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Create a page</h1>
			<p className="text-sm text-gray-500 mb-8">
				This page is saved as you set it up. Cancel deletes it.
			</p>
			<InlineEditSession resource={entity.data as unknown as Record<string, unknown>} onSave={save} canEdit footer="none">
				<PageDraftFields entity={entity} merge={merge} onCancel={cancel} />
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
	// The handle is the one required field, and it only enters the draft once it checks out.
	const hasHandle = !!page.handle || !!session?.dirtyFields.handle;

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

			<NotificationSettingsForm />

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
