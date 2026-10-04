"use client";

import { useEffect, useState } from "react";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { Tag } from "@/lib/components/tag/Tag";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_PAGE_HANDLE } from "@/lib/const/routes";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";
import { HandleEditor } from "@/lib/components/profile/HandleEditor";
import { InlineTextField } from "@/lib/components/profile/InlineTextField";
import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";

type PersonalUser = PublicUser & { email?: string };

// ─── User Fields ───────────────────────────────────────────────────────

function UserFields({ data }: { data: PersonalUser }) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const [editBio, setEditBio] = useState(data.bio || "");
	const [editInterests, setEditInterests] = useState<string[]>(data.interests || []);

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditBio(data.bio || "");
		setEditInterests(data.interests || []);
		setEditingField(null);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const canEdit = session?.canEdit ?? false;

	const currentBio = (session?.dirtyFields.bio as string | null) ?? data.bio;
	const currentInterests = (session?.dirtyFields.interests as string[]) ?? data.interests;

	return (
		<div className="space-y-5">
			{/* Email — readonly */}
			<div>
				<FieldLabel label="Email" />
				<p className="text-base text-warm-grey mt-1">{data.email}</p>
			</div>

			{/* Handle — its own save action (see HandleEditor) */}
			<HandleEditor initialHandle={data.handle} />

			{/* Private fields */}
			<div className="border-t border-gray-100 pt-4">
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Private information</p>

				<div className="space-y-4">
					<InlineTextField name="firstName" label="First Name" original={data.firstName} placeholder="Add first name" />
					<InlineTextField name="middleName" label="Middle Name" original={data.middleName} placeholder="Add middle name" />
					<InlineTextField name="lastName" label="Last Name" original={data.lastName} placeholder="Add last name" />
				</div>
			</div>

			{/* Public fields */}
			<div className="border-t border-gray-100 pt-4">
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Public profile</p>

				<div className="space-y-4">
					<InlineTextField name="displayName" label="Display Name" original={data.displayName} placeholder="Add display name" isPublic />
					<InlineTextField name="headline" label="Headline" original={data.headline} placeholder="Add a headline" maxLength={200} isPublic />

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "bio"}
						onEditStart={() => { setEditBio(currentBio || ""); setEditingField("bio"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Bio" isPublic />
								<InlinePlaceholder value={currentBio} placeholder="Tell people about yourself">
									<p className="text-base text-gray-600 mt-1">{currentBio}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Bio" isPublic />
								<textarea value={editBio} onChange={(e) => { setEditBio(e.target.value); session?.setDirty("bio", e.target.value.trim() || null, data.bio); }} placeholder="Tell people about yourself" rows={4} maxLength={2000} className="w-full border border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown mt-1" autoFocus />
							</div>
						}
					/>

					<InlineTextField name="location" label="Location" original={data.location} placeholder="Add a location" maxLength={200} isPublic />

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "interests"}
						onEditStart={() => { setEditInterests(data.interests || []); setEditingField("interests"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Interests" isPublic />
								{currentInterests.length > 0 ? (
									<div className="mt-2 flex flex-wrap gap-2">
										{currentInterests.map((i) => (
											<Tag key={i} tag={i} />
										))}
									</div>
								) : (
									<InlinePlaceholder value={null} placeholder="Add interests" />
								)}
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Interests" isPublic />
								<div className="mt-1">
									<TagInputField tags={editInterests} onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, data.interests); }} />
								</div>
							</div>
						}
					/>
				</div>
			</div>
		</div>
	);
}

// ─── Page Fields ───────────────────────────────────────────────────────

function PageFields({ data }: { data: PublicPage }) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const [editBio, setEditBio] = useState(data.bio || "");
	const [editInterests, setEditInterests] = useState<string[]>(data.interests || []);
	const [editAddress1, setEditAddress1] = useState(data.addressLine1 || "");
	const [editAddress2, setEditAddress2] = useState(data.addressLine2 || "");
	const [editCity, setEditCity] = useState(data.city || "");
	const [editState, setEditState] = useState(data.state || "");
	const [editZip, setEditZip] = useState(data.zip || "");

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditBio(data.bio || "");
		setEditInterests(data.interests || []);
		setEditAddress1(data.addressLine1 || "");
		setEditAddress2(data.addressLine2 || "");
		setEditCity(data.city || "");
		setEditState(data.state || "");
		setEditZip(data.zip || "");
		setEditingField(null);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const canEdit = session?.canEdit ?? false;

	const currentBio = (session?.dirtyFields.bio as string | null) ?? data.bio;
	const currentInterests = (session?.dirtyFields.interests as string[]) ?? data.interests;
	const currentAddress1 = (session?.dirtyFields.addressLine1 as string | null) ?? data.addressLine1;
	const currentAddress2 = (session?.dirtyFields.addressLine2 as string | null) ?? data.addressLine2;
	const currentCity = (session?.dirtyFields.city as string | null) ?? data.city;
	const currentState = (session?.dirtyFields.state as string | null) ?? data.state;
	const currentZip = (session?.dirtyFields.zip as string | null) ?? data.zip;

	const inputClasses = "w-full text-base border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent";

	return (
		<div className="space-y-5">
			{/* Public fields */}
			<div>
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Public profile</p>

				<div className="space-y-4">
					<InlineTextField name="name" label="Page Name" original={data.name} placeholder="Add page name" isPublic />

					{/* Handle — its own save action (see HandleEditor), scoped to the active page */}
					<HandleEditor initialHandle={data.handle} endpoint={API_ME_PAGE_HANDLE} />

					<InlineTextField name="headline" label="Headline" original={data.headline} placeholder="Add a headline" maxLength={200} isPublic />

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "bio"}
						onEditStart={() => { setEditBio(currentBio || ""); setEditingField("bio"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Bio" isPublic />
								<InlinePlaceholder value={currentBio} placeholder="Describe this page">
									<p className="text-base text-gray-600 mt-1">{currentBio}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Bio" isPublic />
								<textarea value={editBio} onChange={(e) => { setEditBio(e.target.value); session?.setDirty("bio", e.target.value.trim() || null, data.bio); }} placeholder="Describe this page" rows={4} maxLength={2000} className="w-full border border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown mt-1" autoFocus />
							</div>
						}
					/>

					<InlineTextField name="location" label="Location" original={data.location} placeholder="Add a location" maxLength={200} isPublic />

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "interests"}
						onEditStart={() => { setEditInterests(data.interests || []); setEditingField("interests"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Interests" isPublic />
								{currentInterests.length > 0 ? (
									<div className="mt-2 flex flex-wrap gap-2">
										{currentInterests.map((i) => (
											<Tag key={i} tag={i} />
										))}
									</div>
								) : (
									<InlinePlaceholder value={null} placeholder="Add interests" />
								)}
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Interests" isPublic />
								<div className="mt-1">
									<TagInputField tags={editInterests} onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, data.interests); }} />
								</div>
							</div>
						}
					/>
				</div>
			</div>

			{/* Private optional fields */}
			<div className="border-t border-gray-100 pt-4">
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Address (optional)</p>

				<div className="space-y-4">
					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "addressLine1"}
						onEditStart={() => { setEditAddress1(currentAddress1 || ""); setEditingField("addressLine1"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Address Line 1" />
								<InlinePlaceholder value={currentAddress1} placeholder="Add address (optional)">
									<p className="text-base mt-1">{currentAddress1}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Address Line 1" />
								<input type="text" value={editAddress1} onChange={(e) => { setEditAddress1(e.target.value); session?.setDirty("addressLine1", e.target.value.trim() || null, data.addressLine1); }} placeholder="Street address" maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "addressLine2"}
						onEditStart={() => { setEditAddress2(currentAddress2 || ""); setEditingField("addressLine2"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Address Line 2" />
								<InlinePlaceholder value={currentAddress2} placeholder="Apt, suite, etc. (optional)">
									<p className="text-base mt-1">{currentAddress2}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Address Line 2" />
								<input type="text" value={editAddress2} onChange={(e) => { setEditAddress2(e.target.value); session?.setDirty("addressLine2", e.target.value.trim() || null, data.addressLine2); }} placeholder="Apt, suite, etc." maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<div className="grid grid-cols-3 gap-3">
						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "city"}
							onEditStart={() => { setEditCity(currentCity || ""); setEditingField("city"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<div>
									<FieldLabel label="City" />
									<InlinePlaceholder value={currentCity} placeholder="City">
										<p className="text-base mt-1">{currentCity}</p>
									</InlinePlaceholder>
								</div>
							}
							editContent={
								<div>
									<FieldLabel label="City" />
									<input type="text" value={editCity} onChange={(e) => { setEditCity(e.target.value); session?.setDirty("city", e.target.value.trim() || null, data.city); }} placeholder="City" maxLength={100} className={inputClasses} autoFocus />
								</div>
							}
						/>

						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "state"}
							onEditStart={() => { setEditState(currentState || ""); setEditingField("state"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<div>
									<FieldLabel label="State" />
									<InlinePlaceholder value={currentState} placeholder="State">
										<p className="text-base mt-1">{currentState}</p>
									</InlinePlaceholder>
								</div>
							}
							editContent={
								<div>
									<FieldLabel label="State" />
									<input type="text" value={editState} onChange={(e) => { setEditState(e.target.value); session?.setDirty("state", e.target.value.trim() || null, data.state); }} placeholder="State" maxLength={50} className={inputClasses} autoFocus />
								</div>
							}
						/>

						<InlineEditable
							canEdit={canEdit}
							isEditing={editingField === "zip"}
							onEditStart={() => { setEditZip(currentZip || ""); setEditingField("zip"); }}
							onCancel={() => setEditingField(null)}
							displayContent={
								<div>
									<FieldLabel label="Zip" />
									<InlinePlaceholder value={currentZip} placeholder="Zip">
										<p className="text-base mt-1">{currentZip}</p>
									</InlinePlaceholder>
								</div>
							}
							editContent={
								<div>
									<FieldLabel label="Zip" />
									<input type="text" value={editZip} onChange={(e) => { setEditZip(e.target.value); session?.setDirty("zip", e.target.value.trim() || null, data.zip); }} placeholder="Zip" maxLength={20} className={inputClasses} autoFocus />
								</div>
							}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Wrapper ───────────────────────────────────────────────────────────

export function PersonalInfoForm() {
	return (
		<ActiveIdentityEditor>
			{(entity) => {
				const title = entity.type === "user" ? "Personal Info" : "Page Info";
				const subtitle = entity.type === "user"
					? "Manage your personal information. Fields marked with the eye icon are visible on your public profile."
					: "Manage your page information. Fields marked with the eye icon are visible on the public page.";
				return (
					<div>
						<div className="mb-6">
							<h1 className="text-2xl font-bold">{title}</h1>
							<p className="text-sm text-gray-500 mt-1">{subtitle}</p>
						</div>
						{entity.type === "user" ? (
							<UserFields data={entity.data as PersonalUser} />
						) : (
							<PageFields data={entity.data} />
						)}
					</div>
				);
			}}
		</ActiveIdentityEditor>
	);
}
