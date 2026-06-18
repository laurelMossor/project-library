"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { FollowStats } from "@/lib/components/profile/FollowStats";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { Tag } from "@/lib/components/tag/Tag";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { JoinButton } from "@/lib/components/profile/JoinButton";
import { EyeIcon, PencilIcon } from "@/lib/components/icons/icons";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { ProfileElementList } from "@/lib/components/profile/ProfileElementList";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { getUserDisplayName } from "@/lib/types/user";
import { authFetch } from "@/lib/utils/auth-client";
import type { SavePayload } from "@/lib/types/inline-edit";

export type ProfileEditEntity =
	| { type: "user"; data: PublicUser }
	| { type: "page"; data: PublicPage };

type ProfileEditClientProps = {
	entity: ProfileEditEntity;
	saveUrl: string;
};

// ─── Inner content (needs session context) ────────────────────────────────────

function ProfileOwnerContent({
	entity,
	previewMode,
	setPreviewMode,
}: {
	entity: ProfileEditEntity;
	previewMode: boolean;
	setPreviewMode: (v: boolean) => void;
}) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const originalName =
		entity.type === "user" ? getUserDisplayName(entity.data) : entity.data.name;

	// Session-backed fields — dirtyFields is the single source of truth.
	const { value: name, setValue: setName } = useInlineField("name", originalName);
	const { value: headline, setValue: setHeadline } = useInlineField<string | null>("headline", entity.data.headline);
	const { value: bio, setValue: setBio } = useInlineField<string | null>("bio", entity.data.bio);
	const { value: location, setValue: setLocation } = useInlineField<string | null>("location", entity.data.location);
	const { value: interests, setValue: setInterests } = useInlineField<string[]>("interests", entity.data.interests);

	const canEdit = session?.canEdit ?? false;

	// Close any open field whenever editing is disabled (cancel OR save both flip canEdit to false).
	useEffect(() => {
		if (!canEdit) setEditingField(null);
	}, [canEdit]);

	// When session cancels, also close open fields (values revert automatically via session).
	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditingField(null);
	// cancelRevision is the only intended trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);
	const entityId = entity.data.id;
	const entityType = entity.type === "user" ? "user" : "page";
	const connectionsHref = PUBLIC_PROFILE(entity.data.handle);

	const avatarEntity =
		entity.type === "page"
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
				firstName: entity.data.firstName,
				lastName: entity.data.lastName,
				avatarImageId: entity.data.avatarImageId,
				avatarImage: entity.data.avatarImage,
			};

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-4">
					<ClickableProfilePicture entity={avatarEntity} />
					<div>
						{/* Name */}
						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "name"}
							onEditStart={() => setEditingField("name")}
							onCancel={() => setEditingField(null)}
							displayContent={
								<h1 className="text-3xl font-bold">{(name as string) || entity.data.handle}</h1>
							}
							editContent={
								<input
									type="text"
									value={name as string}
									onChange={(e) => setName(e.target.value)}
									placeholder="Name"
									maxLength={100}
									className="text-3xl font-bold border-b-2 border-rich-brown/20 pb-0.5 focus:outline-none focus:border-rich-brown bg-transparent"
									autoFocus
								/>
							}
						/>
						<p className="text-sm text-dusty-grey mt-0.5">@{entity.data.handle}</p>

						{/* Headline */}
						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "headline"}
							onEditStart={() => setEditingField("headline")}
							onCancel={() => setEditingField(null)}
							displayContent={
								<InlinePlaceholder value={headline as string | null} placeholder="Add a headline">
									<p className="text-lg italic text-gray-600 mt-1">{headline as string}</p>
								</InlinePlaceholder>
							}
							editContent={
								<input
									type="text"
									value={(headline as string) || ""}
									onChange={(e) => setHeadline(e.target.value || null)}
									placeholder="Add a headline"
									maxLength={200}
									className="w-full text-lg border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent mt-1"
									autoFocus
								/>
							}
						/>

						{/* Location */}
						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "location"}
							onEditStart={() => setEditingField("location")}
							onCancel={() => setEditingField(null)}
							displayContent={
								<InlinePlaceholder value={location as string | null} placeholder="Add a location">
									<p className="text-sm text-gray-500 mt-0.5">{location as string}</p>
								</InlinePlaceholder>
							}
							editContent={
								<input
									type="text"
									value={(location as string) || ""}
									onChange={(e) => setLocation(e.target.value || null)}
									placeholder="Add a location"
									maxLength={200}
									className="w-full text-sm border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent mt-0.5"
									autoFocus
								/>
							}
						/>
					</div>
				</div>

				{/* Right side */}
				<div className="flex flex-col gap-2 w-36 shrink-0">
					<ProfileButtons entityId={entityId} entityType={entityType} />
					{entity.type === "page" && <JoinButton pageId={entity.data.id} />}
					<TransparentCTAButton
						label={previewMode ? "Edit" : "Preview"}
						icon={previewMode ? <PencilIcon className="w-4 h-4" /> : <EyeIcon className="w-4 h-4" />}
						onClick={() => setPreviewMode(!previewMode)}
						className="w-full"
					/>
				</div>
			</div>

			{/* Body */}
			<div className="space-y-4">
				{/* Bio */}
				<InlineEditable
					canEdit={canEdit}
					isEditing={editingField === "bio"}
					onEditStart={() => setEditingField("bio")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<InlinePlaceholder value={bio as string | null} placeholder="Tell people about yourself">
							<p className="text-gray-600">{bio as string}</p>
						</InlinePlaceholder>
					}
					editContent={
						<textarea
							value={(bio as string) || ""}
							onChange={(e) => setBio(e.target.value || null)}
							placeholder="Tell people about yourself"
							rows={4}
							maxLength={2000}
							className="w-full border border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Interests */}
				<InlineEditable
					canEdit={canEdit}
					isEditing={editingField === "interests"}
					onEditStart={() => setEditingField("interests")}
					onCancel={() => setEditingField(null)}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">Interests</h2>
							{(interests as string[]).length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{(interests as string[]).map((i) => <Tag key={i} tag={i} />)}
								</div>
							) : (
								<InlinePlaceholder value={null} placeholder="Add interests" />
							)}
						</div>
					}
					editContent={
						<TagInputField
							tags={interests as string[]}
							onTagsChange={(tags) => setInterests(tags)}
							placeholder="Add interests"
						/>
					}
				/>

				{/* Profile elements */}
				<ProfileElementList
					elements={entity.data.elements ?? []}
					handle={entity.data.handle}
					hasAboutContent={!!entity.data.aboutContent}
				/>

				{/* Follow stats — always last */}
				<FollowStats entityId={entityId} entityType={entityType} connectionsHref={connectionsHref} />
			</div>
		</div>
	);
}

// ─── Outer wrapper ────────────────────────────────────────────────────────────

export function ProfileEditClient({ entity: initialEntity, saveUrl }: ProfileEditClientProps) {
	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();
	const [entity, setEntity] = useState(initialEntity);

	// URL is the source of truth for edit/preview state
	const previewMode = searchParams.get("edit") !== "true";

	const setPreviewMode = useCallback((preview: boolean) => {
		const params = new URLSearchParams(searchParams.toString());
		if (preview) {
			params.delete("edit");
		} else {
			params.set("edit", "true");
		}
		const query = params.toString();
		router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
	}, [router, pathname, searchParams]);

	const handleSave = async (payload: SavePayload) => {
		const fields = { ...payload.fields };

		if ("name" in fields) {
			if (entity.type === "user") {
				fields.displayName = fields.name;
				delete fields.name;
			}
			// For page, "name" is already the correct field name
		}

		const res = await authFetch(saveUrl, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ ...payload, fields }),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		return res.json();
	};

	return (
		<InlineEditSession
			resource={entity.data as unknown as Record<string, unknown>}
			onSave={handleSave as (payload: SavePayload) => Promise<Record<string, unknown> | void>}
			onSaved={(updated) => {
				setEntity((prev) =>
					prev.type === "user"
						? { type: "user", data: { ...prev.data, ...(updated as Partial<PublicUser>) } }
						: { type: "page", data: { ...prev.data, ...(updated as Partial<PublicPage>) } }
				);
				// Bug #1 fix: return to preview/view mode after a successful save
				setPreviewMode(true);
			}}
			canEdit={!previewMode}
		>
			<ProfileOwnerContent
				entity={entity}
				previewMode={previewMode}
				setPreviewMode={setPreviewMode}
			/>
		</InlineEditSession>
	);
}
