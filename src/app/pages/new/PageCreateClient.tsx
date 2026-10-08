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
import { useDiscardOnLeave } from "@/lib/hooks/useDiscardOnLeave";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_PAGE_HANDLE, API_PAGES, API_PAGE, PUBLIC_PROFILE, SETTINGS } from "@/lib/const/routes";
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
 * immediately, so notification preferences can save against it. It is only kept once
 * the person says it looks good. Cancel or leaving deletes that staged row.
 */
export function PageCreateClient() {
	const router = useRouter();
	const { switchProfile } = useActiveProfile();
	const [entity, setEntity] = useState<IdentityEntity>({ type: "page", data: BLANK_PAGE });
	const [error, setError] = useState("");
	const started = useRef(false);
	const pageIdRef = useRef("");
	const { keep, discard, wasDiscarded } = useDiscardOnLeave(() => {
		const id = pageIdRef.current;
		if (!id) return;
		return fetch(API_PAGE(id), { method: "DELETE", keepalive: true });
	});

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
				if (!wasDiscarded()) setError(body.error || "Failed to create page");
				return;
			}
			// Leave may have won the race before this id existed. Drop the row either way.
			pageIdRef.current = body.id;
			if (wasDiscarded()) {
				void fetch(API_PAGE(body.id), { method: "DELETE", keepalive: true });
				return;
			}
			// The handle save on confirm uses the active page, so the session has to know it
			// before the form can be submitted.
			const switched = await switchProfile(body.id);
			if (wasDiscarded()) {
				void fetch(API_PAGE(body.id), { method: "DELETE", keepalive: true });
				return;
			}
			if (!switched) {
				setError("Failed to open the new page");
				return;
			}
			setEntity({ type: "page", data: body as PublicPage });
		})();
	}, [switchProfile, wasDiscarded]);

	async function save(payload: SavePayload) {
		const fields = { ...payload.fields };
		// A page left unnamed takes its handle as the name. The handle may already
		// be on the staged page, so it isn't always a dirty field.
		const nextHandle = typeof fields.handle === "string" && fields.handle ? fields.handle : entity.data.handle;
		if (!fields.name) fields.name = nextHandle;
		let handle = entity.data.handle;
		// The profile save drops handle; it has to move the Handle row through its own route.
		if (typeof fields.handle === "string" && fields.handle && fields.handle !== entity.data.handle) {
			const handleRes = await fetch(API_ME_PAGE_HANDLE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ handle: fields.handle }),
			});
			const handleBody = await handleRes.json().catch(() => ({}));
			if (!handleRes.ok) throw new Error(handleBody.error || "Failed to save handle");
			handle = handleBody.handle ?? fields.handle;
		}
		delete fields.handle;
		const res = await fetch(API_PAGE(entity.data.id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...payload, fields }),
		});
		const body = await res.json().catch(() => ({}));
		if (!res.ok) throw new Error(body.error || "Failed to save page");
		keep();
		router.push(PUBLIC_PROFILE(body.handle ?? handle));
		return { ...body, handle: body.handle ?? handle };
	}

	async function cancel() {
		await discard();
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
				This page is only kept once you say it looks good. Cancel or leave and it is deleted.
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
