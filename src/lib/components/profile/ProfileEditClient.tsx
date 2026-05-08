"use client";

import { useEffect, useState } from "react";
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
import { EyeIcon } from "@/lib/components/icons/icons";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";
import { ProfileElementList } from "@/lib/components/profile/ProfileElementList";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { getUserDisplayName } from "@/lib/types/user";
import { authFetch } from "@/lib/utils/auth-client";
import type { SavePayload } from "@/lib/types/inline-edit";

export type ProfileEditEntity =
	| { type: "user"; data: PublicUser }
	| { type: "page"; data: PublicPage };

type ProfileEditClientProps = {
	entity: ProfileEditEntity;
	saveUrl: string;
	onPreview?: () => void;
};

// ─── Inner content (needs session context) ────────────────────────────────────

function ProfileOwnerContent({
	entity,
	previewMode,
	setPreviewMode,
	onPreview,
}: {
	entity: ProfileEditEntity;
	previewMode: boolean;
	setPreviewMode: (v: boolean) => void;
	onPreview?: () => void;
}) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const originalName =
		entity.type === "user" ? getUserDisplayName(entity.data) : entity.data.name;

	const [editName, setEditName] = useState(originalName);
	const [editHeadline, setEditHeadline] = useState(entity.data.headline || "");
	const [editBio, setEditBio] = useState(entity.data.bio || "");
	const [editLocation, setEditLocation] = useState(entity.data.location || "");
	const [editInterests, setEditInterests] = useState<string[]>(entity.data.interests);

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditName(originalName);
		setEditHeadline(entity.data.headline || "");
		setEditBio(entity.data.bio || "");
		setEditLocation(entity.data.location || "");
		setEditInterests(entity.data.interests);
		setEditingField(null);
	// cancelRevision is the only intended trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const canEdit = session?.canEdit ?? false;
	const entityId = entity.data.id;
	const entityType = entity.type === "user" ? "user" : "page";
	const connectionsHref = PUBLIC_PROFILE(entity.data.handle);

	const currentName = (session?.dirtyFields.name as string) ?? originalName;
	const currentHeadline = (session?.dirtyFields.headline as string | null) ?? entity.data.headline;
	const currentLocation = (session?.dirtyFields.location as string | null) ?? entity.data.location;
	const currentBio = (session?.dirtyFields.bio as string | null) ?? entity.data.bio;
	const currentInterests = (session?.dirtyFields.interests as string[]) ?? entity.data.interests;

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
							onEditStart={() => { setEditName(currentName); setEditingField("name"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<h1 className="text-3xl font-bold">{currentName || entity.data.handle}</h1>
							}
							editContent={
								<input
									type="text"
									value={editName}
									onChange={(e) => {
										setEditName(e.target.value);
										session?.setDirty("name", e.target.value, originalName);
									}}
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
							onEditStart={() => { setEditHeadline(entity.data.headline || ""); setEditingField("headline"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<InlinePlaceholder value={currentHeadline} placeholder="Add a headline">
									<p className="text-lg italic text-gray-600 mt-1">{currentHeadline}</p>
								</InlinePlaceholder>
							}
							editContent={
								<input
									type="text"
									value={editHeadline}
									onChange={(e) => { setEditHeadline(e.target.value); session?.setDirty("headline", e.target.value || null, entity.data.headline); }}
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
							onEditStart={() => { setEditLocation(entity.data.location || ""); setEditingField("location"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<InlinePlaceholder value={currentLocation} placeholder="Add a location">
									<p className="text-sm text-gray-500 mt-0.5">{currentLocation}</p>
								</InlinePlaceholder>
							}
							editContent={
								<input
									type="text"
									value={editLocation}
									onChange={(e) => { setEditLocation(e.target.value); session?.setDirty("location", e.target.value || null, entity.data.location); }}
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
						label={onPreview ? "Preview" : (previewMode ? "Back to editing" : "Preview")}
						icon={<EyeIcon className="w-4 h-4" />}
						onClick={onPreview ? onPreview : () => setPreviewMode(!previewMode)}
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
					onEditStart={() => { setEditBio(entity.data.bio || ""); setEditingField("bio"); }}
					onCancel={() => setEditingField(null)}
					displayContent={
						<InlinePlaceholder value={currentBio} placeholder="Tell people about yourself">
							<p className="text-gray-600">{currentBio}</p>
						</InlinePlaceholder>
					}
					editContent={
						<textarea
							value={editBio}
							onChange={(e) => { setEditBio(e.target.value); session?.setDirty("bio", e.target.value || null, entity.data.bio); }}
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
					onEditStart={() => { setEditInterests(entity.data.interests); setEditingField("interests"); }}
					onCancel={() => setEditingField(null)}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">Interests</h2>
							{currentInterests.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{currentInterests.map((i) => <Tag key={i} tag={i} />)}
								</div>
							) : (
								<InlinePlaceholder value={null} placeholder="Add interests" />
							)}
						</div>
					}
					editContent={
						<TagInputField
							tags={editInterests}
							onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, entity.data.interests); }}
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

export function ProfileEditClient({ entity: initialEntity, saveUrl, onPreview }: ProfileEditClientProps) {
	const [entity, setEntity] = useState(initialEntity);
	const [previewMode, setPreviewMode] = useState(false);

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
			onSaved={(updated) =>
				setEntity((prev) =>
					prev.type === "user"
						? { type: "user", data: { ...prev.data, ...(updated as Partial<PublicUser>) } }
						: { type: "page", data: { ...prev.data, ...(updated as Partial<PublicPage>) } }
				)
			}
			canEdit={!previewMode}
		>
			<ProfileOwnerContent
				entity={entity}
				previewMode={previewMode}
				setPreviewMode={setPreviewMode}
				onPreview={onPreview}
			/>
		</InlineEditSession>
	);
}
