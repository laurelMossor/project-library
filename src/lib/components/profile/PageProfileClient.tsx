"use client";

import { useEffect, useState } from "react";
import { PublicPage } from "@/lib/types/page";
import { ProfileEntity } from "@/lib/types/profile";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { FollowStats } from "@/lib/components/profile/FollowStats";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { Tag } from "@/lib/components/tag/Tag";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { JoinButton } from "@/lib/components/profile/JoinButton";
import { API_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { authFetch } from "@/lib/utils/auth-client";

type PageProfileClientProps = {
	page: PublicPage;
};

function PageProfileOwnerContent({
	page,
	setPage,
}: {
	page: PublicPage;
	setPage: React.Dispatch<React.SetStateAction<PublicPage>>;
}) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const [editName, setEditName] = useState(page.name);
	const [editHeadline, setEditHeadline] = useState(page.headline || "");
	const [editBio, setEditBio] = useState(page.bio || "");
	const [editLocation, setEditLocation] = useState(page.location || "");
	const [editInterests, setEditInterests] = useState<string[]>(page.interests);
	const [editTags, setEditTags] = useState<string[]>(page.tags);
	const [editAddressLine1, setEditAddressLine1] = useState(page.addressLine1 || "");
	const [editAddressLine2, setEditAddressLine2] = useState(page.addressLine2 || "");
	const [editCity, setEditCity] = useState(page.city || "");
	const [editState, setEditState] = useState(page.state || "");
	const [editZip, setEditZip] = useState(page.zip || "");

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditName(page.name);
		setEditHeadline(page.headline || "");
		setEditBio(page.bio || "");
		setEditLocation(page.location || "");
		setEditInterests(page.interests);
		setEditTags(page.tags);
		setEditAddressLine1(page.addressLine1 || "");
		setEditAddressLine2(page.addressLine2 || "");
		setEditCity(page.city || "");
		setEditState(page.state || "");
		setEditZip(page.zip || "");
		setEditingField(null);
	// cancelRevision changing is the only trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const entity = {
		id: page.id,
		name: page.name,
		handle: page.handle,
		avatarImageId: page.avatarImageId,
		avatarImage: page.avatarImage,
	};
	const connectionsHref = PUBLIC_PROFILE(page.handle);

	return (
		<div className="flex flex-col gap-6">
			{/* Header */}
			<div className="flex items-start justify-between gap-4">
				<div className="flex items-center gap-4">
					{/* Avatar — handled by modal, isolate from session */}
					<ClickableProfilePicture entity={entity} />
					<div>
						<InlineEditable
							canEdit
							isEditing={editingField === "name"}
							onEditStart={() => { setEditName(page.name); setEditingField("name"); }}
							onCancel={() => { setEditingField(null);  }}
							displayContent={
								<h1 className="text-3xl font-bold">{page.name}</h1>
							}
							editContent={
								<input
									type="text"
									value={editName}
									onChange={(e) => { setEditName(e.target.value); session?.setDirty("name", e.target.value, page.name); }}
									placeholder="Page name"
									maxLength={100}
									className="text-3xl font-bold border-b-2 border-rich-brown/20 pb-0.5 focus:outline-none focus:border-rich-brown bg-transparent"
									autoFocus
								/>
							}
						/>
						<p className="text-sm text-dusty-grey mt-0.5">@{page.handle}</p>
					</div>
				</div>

				<div className="flex flex-col gap-2 w-36 shrink-0">
					<ProfileButtons entityId={page.id} entityType="page" />
					<JoinButton pageId={page.id} />
				</div>
			</div>

			{/* Body fields */}
			<div className="space-y-4">
				{/* Headline */}
				<InlineEditable
					canEdit
					isEditing={editingField === "headline"}
					onEditStart={() => { setEditHeadline(page.headline || ""); setEditingField("headline"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<InlinePlaceholder value={page.headline} placeholder="Add a headline">
							<p className="text-lg">{page.headline}</p>
						</InlinePlaceholder>
					}
					editContent={
						<input
							type="text"
							value={editHeadline}
							onChange={(e) => { setEditHeadline(e.target.value); session?.setDirty("headline", e.target.value || null, page.headline); }}
							placeholder="Add a headline"
							maxLength={200}
							className="w-full text-lg border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent"
							autoFocus
						/>
					}
				/>

				{/* Location */}
				<InlineEditable
					canEdit
					isEditing={editingField === "location"}
					onEditStart={() => { setEditLocation(page.location || ""); setEditingField("location"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<InlinePlaceholder value={page.location} placeholder="Add a location">
							<p className="text-sm text-gray-500">{page.location}</p>
						</InlinePlaceholder>
					}
					editContent={
						<input
							type="text"
							value={editLocation}
							onChange={(e) => { setEditLocation(e.target.value); session?.setDirty("location", e.target.value || null, page.location); }}
							placeholder="Add a location"
							maxLength={200}
							className="w-full text-sm border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent"
							autoFocus
						/>
					}
				/>

				{/* Bio */}
				<InlineEditable
					canEdit
					isEditing={editingField === "bio"}
					onEditStart={() => { setEditBio(page.bio || ""); setEditingField("bio"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">About</h2>
							<InlinePlaceholder value={page.bio} placeholder="Tell people about this page">
								<p className="mt-1">{page.bio}</p>
							</InlinePlaceholder>
						</div>
					}
					editContent={
						<textarea
							value={editBio}
							onChange={(e) => { setEditBio(e.target.value); session?.setDirty("bio", e.target.value || null, page.bio); }}
							placeholder="Tell people about this page"
							rows={4}
							maxLength={2000}
							className="w-full border border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Interests */}
				<InlineEditable
					canEdit
					isEditing={editingField === "interests"}
					onEditStart={() => { setEditInterests(page.interests); setEditingField("interests"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">Interests</h2>
							{page.interests.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{page.interests.map((i) => <Tag key={i} tag={i} />)}
								</div>
							) : (
								<InlinePlaceholder value={null} placeholder="Add interests" />
							)}
						</div>
					}
					editContent={
						<TagInputField
							tags={editInterests}
							onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, page.interests); }}
							placeholder="Add interests"
						/>
					}
				/>

				<FollowStats entityId={page.id} entityType="page" connectionsHref={connectionsHref} />

				{/* Tags */}
				<InlineEditable
					canEdit
					isEditing={editingField === "tags"}
					onEditStart={() => { setEditTags(page.tags); setEditingField("tags"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">Tags</h2>
							{page.tags.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{page.tags.map((t) => <Tag key={t} tag={t} />)}
								</div>
							) : (
								<InlinePlaceholder value={null} placeholder="Add tags" />
							)}
						</div>
					}
					editContent={
						<TagInputField
							tags={editTags}
							onTagsChange={(tags) => { setEditTags(tags); session?.setDirty("tags", tags, page.tags); }}
							placeholder="Add tags"
						/>
					}
				/>

				{/* Address */}
				<InlineEditable
					canEdit
					isEditing={editingField === "address"}
					onEditStart={() => {
						setEditAddressLine1(page.addressLine1 || "");
						setEditAddressLine2(page.addressLine2 || "");
						setEditCity(page.city || "");
						setEditState(page.state || "");
						setEditZip(page.zip || "");
						setEditingField("address");
					}}
					onCancel={() => {
						setEditingField(null);
					}}
					displayContent={
						(page.addressLine1 || page.city) ? (
							<div>
								<h2 className="text-sm font-medium text-gray-500">Address</h2>
								<div className="mt-1 text-sm text-gray-700 space-y-0.5">
									{page.addressLine1 && <p>{page.addressLine1}</p>}
									{page.addressLine2 && <p>{page.addressLine2}</p>}
									{(page.city || page.state || page.zip) && (
										<p>{[page.city, page.state, page.zip].filter(Boolean).join(", ")}</p>
									)}
								</div>
							</div>
						) : (
							<InlinePlaceholder value={null} placeholder="Add address" />
						)
					}
					editContent={
						<div className="space-y-2">
							<input type="text" value={editAddressLine1} onChange={(e) => { setEditAddressLine1(e.target.value); session?.setDirty("addressLine1", e.target.value || null, page.addressLine1); }} placeholder="Street address" className="w-full border rounded px-2 py-1 text-sm" />
							<input type="text" value={editAddressLine2} onChange={(e) => { setEditAddressLine2(e.target.value); session?.setDirty("addressLine2", e.target.value || null, page.addressLine2); }} placeholder="Suite, apt, etc." className="w-full border rounded px-2 py-1 text-sm" />
							<div className="grid grid-cols-3 gap-2">
								<input type="text" value={editCity} onChange={(e) => { setEditCity(e.target.value); session?.setDirty("city", e.target.value || null, page.city); }} placeholder="City" className="border rounded px-2 py-1 text-sm" />
								<input type="text" value={editState} onChange={(e) => { setEditState(e.target.value); session?.setDirty("state", e.target.value || null, page.state); }} placeholder="State" className="border rounded px-2 py-1 text-sm" />
								<input type="text" value={editZip} onChange={(e) => { setEditZip(e.target.value); session?.setDirty("zip", e.target.value || null, page.zip); }} placeholder="ZIP" className="border rounded px-2 py-1 text-sm" />
							</div>
						</div>
					}
				/>

				{page.isOpenToCollaborators && (
					<span className="inline-block text-xs px-2 py-1 rounded border border-soft-grey/60 text-dusty-grey">
						Open to collaborators
					</span>
				)}
			</div>
		</div>
	);
}

export function PageProfileClient({ page: initialPage }: PageProfileClientProps) {
	const [page, setPage] = useState(initialPage);

	const handleSave = async (patch: Partial<Record<string, unknown>>) => {
		const res = await authFetch(API_PAGE(page.id), {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(patch),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		const updated = await res.json();
		setPage((prev) => ({ ...prev, ...updated }));
		return updated;
	};

	return (
		<InlineEditSession
			resource={page as unknown as Record<string, unknown>}
			onSave={handleSave}
			onSaved={(updated) => setPage((prev) => ({ ...prev, ...(updated as Partial<PublicPage>) }))}
			canEdit
		>
			<PageProfileOwnerContent page={page} setPage={setPage} />
		</InlineEditSession>
	);
}
