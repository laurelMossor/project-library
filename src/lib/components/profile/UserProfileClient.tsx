"use client";

import { useEffect, useState } from "react";
import { PublicUser } from "@/lib/types/user";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { FollowStats } from "@/lib/components/profile/FollowStats";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { Tag } from "@/lib/components/tag/Tag";
import { ProfileButtons } from "@/lib/components/profile/ProfileButtons";
import { API_ME_USER, PUBLIC_USER_PAGE } from "@/lib/const/routes";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { getUserDisplayName } from "@/lib/types/user";
import { authFetch } from "@/lib/utils/auth-client";

type UserProfileClientProps = {
	user: PublicUser;
};

function UserProfileOwnerContent({
	user,
	setUser,
}: {
	user: PublicUser;
	setUser: React.Dispatch<React.SetStateAction<PublicUser>>;
}) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const [editFirstName, setEditFirstName] = useState(user.firstName || "");
	const [editLastName, setEditLastName] = useState(user.lastName || "");
	const [editHeadline, setEditHeadline] = useState(user.headline || "");
	const [editBio, setEditBio] = useState(user.bio || "");
	const [editLocation, setEditLocation] = useState(user.location || "");
	const [editInterests, setEditInterests] = useState<string[]>(user.interests);

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditFirstName(user.firstName || "");
		setEditLastName(user.lastName || "");
		setEditHeadline(user.headline || "");
		setEditBio(user.bio || "");
		setEditLocation(user.location || "");
		setEditInterests(user.interests);
		setEditingField(null);
	// cancelRevision changing is the only trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const displayName = getUserDisplayName(user);
	const entity = {
		id: user.id,
		username: user.username,
		displayName: user.displayName,
		firstName: user.firstName,
		lastName: user.lastName,
		avatarImageId: user.avatarImageId,
		avatarImage: user.avatarImage,
	};
	const connectionsHref = PUBLIC_USER_PAGE(user.username);

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
							onEditStart={() => {
								setEditFirstName(user.firstName || "");
								setEditLastName(user.lastName || "");
								setEditingField("name");
							}}
							onCancel={() => {
								setEditingField(null);
								
								
							}}
							displayContent={
								<h1 className="text-3xl font-bold">{displayName}</h1>
							}
							editContent={
								<div className="flex gap-2">
									<input
										type="text"
										value={editFirstName}
										onChange={(e) => { setEditFirstName(e.target.value); session?.setDirty("firstName", e.target.value || null, user.firstName); }}
										placeholder="First name"
										maxLength={50}
										className="text-3xl font-bold border-b-2 border-rich-brown/20 pb-0.5 w-32 focus:outline-none focus:border-rich-brown bg-transparent"
										autoFocus
									/>
									<input
										type="text"
										value={editLastName}
										onChange={(e) => { setEditLastName(e.target.value); session?.setDirty("lastName", e.target.value || null, user.lastName); }}
										placeholder="Last name"
										maxLength={50}
										className="text-3xl font-bold border-b-2 border-rich-brown/20 pb-0.5 w-32 focus:outline-none focus:border-rich-brown bg-transparent"
									/>
								</div>
							}
						/>
						<p className="text-sm text-dusty-grey mt-0.5">@{user.username}</p>
					</div>
				</div>

				<div className="flex flex-col gap-2 w-36 shrink-0">
					<ProfileButtons entityId={user.id} entityType="user" />
				</div>
			</div>

			{/* Body fields */}
			<div className="space-y-4">
				{/* Headline */}
				<InlineEditable
					canEdit
					isEditing={editingField === "headline"}
					onEditStart={() => { setEditHeadline(user.headline || ""); setEditingField("headline"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<InlinePlaceholder value={user.headline} placeholder="Add a headline">
							<p className="text-lg">{user.headline}</p>
						</InlinePlaceholder>
					}
					editContent={
						<input
							type="text"
							value={editHeadline}
							onChange={(e) => { setEditHeadline(e.target.value); session?.setDirty("headline", e.target.value || null, user.headline); }}
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
					onEditStart={() => { setEditLocation(user.location || ""); setEditingField("location"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<InlinePlaceholder value={user.location} placeholder="Add a location">
							<p className="text-sm text-gray-500">{user.location}</p>
						</InlinePlaceholder>
					}
					editContent={
						<input
							type="text"
							value={editLocation}
							onChange={(e) => { setEditLocation(e.target.value); session?.setDirty("location", e.target.value || null, user.location); }}
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
					onEditStart={() => { setEditBio(user.bio || ""); setEditingField("bio"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">About</h2>
							<InlinePlaceholder value={user.bio} placeholder="Tell people about yourself">
								<p className="mt-1">{user.bio}</p>
							</InlinePlaceholder>
						</div>
					}
					editContent={
						<textarea
							value={editBio}
							onChange={(e) => { setEditBio(e.target.value); session?.setDirty("bio", e.target.value || null, user.bio); }}
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
					canEdit
					isEditing={editingField === "interests"}
					onEditStart={() => { setEditInterests(user.interests); setEditingField("interests"); }}
					onCancel={() => { setEditingField(null);  }}
					displayContent={
						<div>
							<h2 className="text-sm font-medium text-gray-500">Interests</h2>
							{user.interests.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{user.interests.map((i) => <Tag key={i} tag={i} />)}
								</div>
							) : (
								<InlinePlaceholder value={null} placeholder="Add interests" />
							)}
						</div>
					}
					editContent={
						<TagInputField
							tags={editInterests}
							onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, user.interests); }}
							placeholder="Add interests"
						/>
					}
				/>

				<FollowStats entityId={user.id} entityType="user" connectionsHref={connectionsHref} />
			</div>
		</div>
	);
}

export function UserProfileClient({ user: initialUser }: UserProfileClientProps) {
	const [user, setUser] = useState(initialUser);

	const handleSave = async (patch: Partial<Record<string, unknown>>) => {
		const res = await authFetch(API_ME_USER, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(patch),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		const updated = await res.json();
		setUser((prev) => ({ ...prev, ...updated }));
		return updated;
	};

	return (
		<InlineEditSession
			resource={user as unknown as Record<string, unknown>}
			onSave={handleSave}
			onSaved={(updated) => setUser((prev) => ({ ...prev, ...(updated as Partial<PublicUser>) }))}
			canEdit
		>
			<UserProfileOwnerContent user={user} setUser={setUser} />
		</InlineEditSession>
	);
}
