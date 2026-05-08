"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { EyeIcon } from "@/lib/components/icons/icons";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { authFetch } from "@/lib/utils/auth-client";
import { API_ME_USER, API_ME_PAGE, SETTINGS } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { PublicUser } from "@/lib/types/user";
import type { PublicPage } from "@/lib/types/page";

type PersonalUser = PublicUser & { email?: string };

function PublicBadge() {
	return (
		<span className="inline-flex items-center gap-1 text-xs text-dusty-grey ml-2">
			<EyeIcon className="w-3 h-3" />
			Public
		</span>
	);
}

function FieldLabel({ label, isPublic = false }: { label: string; isPublic?: boolean }) {
	return (
		<span className="text-sm font-medium text-gray-500">
			{label}
			{isPublic && <PublicBadge />}
		</span>
	);
}

// ─── User Fields ───────────────────────────────────────────────────────

function UserFields({ data }: { data: PersonalUser }) {
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const [editFirstName, setEditFirstName] = useState(data.firstName || "");
	const [editMiddleName, setEditMiddleName] = useState(data.middleName || "");
	const [editLastName, setEditLastName] = useState(data.lastName || "");
	const [editDisplayName, setEditDisplayName] = useState(data.displayName || "");
	const [editHeadline, setEditHeadline] = useState(data.headline || "");
	const [editBio, setEditBio] = useState(data.bio || "");
	const [editLocation, setEditLocation] = useState(data.location || "");
	const [editInterests, setEditInterests] = useState<string[]>(data.interests || []);

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditFirstName(data.firstName || "");
		setEditMiddleName(data.middleName || "");
		setEditLastName(data.lastName || "");
		setEditDisplayName(data.displayName || "");
		setEditHeadline(data.headline || "");
		setEditBio(data.bio || "");
		setEditLocation(data.location || "");
		setEditInterests(data.interests || []);
		setEditingField(null);
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const canEdit = session?.canEdit ?? false;

	const currentFirstName = (session?.dirtyFields.firstName as string | null) ?? data.firstName;
	const currentMiddleName = (session?.dirtyFields.middleName as string | null) ?? data.middleName;
	const currentLastName = (session?.dirtyFields.lastName as string | null) ?? data.lastName;
	const currentDisplayName = (session?.dirtyFields.displayName as string | null) ?? data.displayName;
	const currentHeadline = (session?.dirtyFields.headline as string | null) ?? data.headline;
	const currentBio = (session?.dirtyFields.bio as string | null) ?? data.bio;
	const currentLocation = (session?.dirtyFields.location as string | null) ?? data.location;
	const currentInterests = (session?.dirtyFields.interests as string[]) ?? data.interests;

	const inputClasses = "w-full text-base border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent";

	return (
		<div className="space-y-5">
			{/* Email — readonly */}
			<div>
				<FieldLabel label="Email" />
				<p className="text-base text-warm-grey mt-1">{data.email}</p>
			</div>

			{/* Private fields */}
			<div className="border-t border-gray-100 pt-4">
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Private information</p>

				<div className="space-y-4">
					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "firstName"}
						onEditStart={() => { setEditFirstName(currentFirstName || ""); setEditingField("firstName"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="First Name" />
								<InlinePlaceholder value={currentFirstName} placeholder="Add first name">
									<p className="text-base mt-1">{currentFirstName}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="First Name" />
								<input type="text" value={editFirstName} onChange={(e) => { setEditFirstName(e.target.value); session?.setDirty("firstName", e.target.value.trim() || null, data.firstName); }} placeholder="First name" maxLength={100} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "middleName"}
						onEditStart={() => { setEditMiddleName(currentMiddleName || ""); setEditingField("middleName"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Middle Name" />
								<InlinePlaceholder value={currentMiddleName} placeholder="Add middle name">
									<p className="text-base mt-1">{currentMiddleName}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Middle Name" />
								<input type="text" value={editMiddleName} onChange={(e) => { setEditMiddleName(e.target.value); session?.setDirty("middleName", e.target.value.trim() || null, data.middleName); }} placeholder="Middle name" maxLength={100} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "lastName"}
						onEditStart={() => { setEditLastName(currentLastName || ""); setEditingField("lastName"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Last Name" />
								<InlinePlaceholder value={currentLastName} placeholder="Add last name">
									<p className="text-base mt-1">{currentLastName}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Last Name" />
								<input type="text" value={editLastName} onChange={(e) => { setEditLastName(e.target.value); session?.setDirty("lastName", e.target.value.trim() || null, data.lastName); }} placeholder="Last name" maxLength={100} className={inputClasses} autoFocus />
							</div>
						}
					/>
				</div>
			</div>

			{/* Public fields */}
			<div className="border-t border-gray-100 pt-4">
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">Public profile</p>

				<div className="space-y-4">
					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "displayName"}
						onEditStart={() => { setEditDisplayName(currentDisplayName || ""); setEditingField("displayName"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Display Name" isPublic />
								<InlinePlaceholder value={currentDisplayName} placeholder="Add display name">
									<p className="text-base mt-1">{currentDisplayName}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Display Name" isPublic />
								<input type="text" value={editDisplayName} onChange={(e) => { setEditDisplayName(e.target.value); session?.setDirty("displayName", e.target.value.trim() || null, data.displayName); }} placeholder="Display name" maxLength={100} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "headline"}
						onEditStart={() => { setEditHeadline(currentHeadline || ""); setEditingField("headline"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Headline" isPublic />
								<InlinePlaceholder value={currentHeadline} placeholder="Add a headline">
									<p className="text-base mt-1">{currentHeadline}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Headline" isPublic />
								<input type="text" value={editHeadline} onChange={(e) => { setEditHeadline(e.target.value); session?.setDirty("headline", e.target.value.trim() || null, data.headline); }} placeholder="Add a headline" maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

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

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "location"}
						onEditStart={() => { setEditLocation(currentLocation || ""); setEditingField("location"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Location" isPublic />
								<InlinePlaceholder value={currentLocation} placeholder="Add a location">
									<p className="text-base mt-1">{currentLocation}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Location" isPublic />
								<input type="text" value={editLocation} onChange={(e) => { setEditLocation(e.target.value); session?.setDirty("location", e.target.value.trim() || null, data.location); }} placeholder="Add a location" maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

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
											<span key={i} className="px-3 py-1 bg-melon-green border border-ash-green text-misty-forest text-xs rounded-full">{i}</span>
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
									<TagInputField tags={editInterests} onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, data.interests); }} placeholder="Type and press Enter" />
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

	const [editName, setEditName] = useState(data.name || "");
	const [editHeadline, setEditHeadline] = useState(data.headline || "");
	const [editBio, setEditBio] = useState(data.bio || "");
	const [editLocation, setEditLocation] = useState(data.location || "");
	const [editInterests, setEditInterests] = useState<string[]>(data.interests || []);
	const [editAddress1, setEditAddress1] = useState(data.addressLine1 || "");
	const [editAddress2, setEditAddress2] = useState(data.addressLine2 || "");
	const [editCity, setEditCity] = useState(data.city || "");
	const [editState, setEditState] = useState(data.state || "");
	const [editZip, setEditZip] = useState(data.zip || "");

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditName(data.name || "");
		setEditHeadline(data.headline || "");
		setEditBio(data.bio || "");
		setEditLocation(data.location || "");
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

	const currentName = (session?.dirtyFields.name as string | null) ?? data.name;
	const currentHeadline = (session?.dirtyFields.headline as string | null) ?? data.headline;
	const currentBio = (session?.dirtyFields.bio as string | null) ?? data.bio;
	const currentLocation = (session?.dirtyFields.location as string | null) ?? data.location;
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
					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "name"}
						onEditStart={() => { setEditName(currentName || ""); setEditingField("name"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Page Name" isPublic />
								<InlinePlaceholder value={currentName} placeholder="Add page name">
									<p className="text-base font-semibold mt-1">{currentName}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Page Name" isPublic />
								<input type="text" value={editName} onChange={(e) => { setEditName(e.target.value); session?.setDirty("name", e.target.value.trim() || null, data.name); }} placeholder="Page name" maxLength={100} className={inputClasses} autoFocus />
							</div>
						}
					/>

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "headline"}
						onEditStart={() => { setEditHeadline(currentHeadline || ""); setEditingField("headline"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Headline" isPublic />
								<InlinePlaceholder value={currentHeadline} placeholder="Add a headline">
									<p className="text-base mt-1">{currentHeadline}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Headline" isPublic />
								<input type="text" value={editHeadline} onChange={(e) => { setEditHeadline(e.target.value); session?.setDirty("headline", e.target.value.trim() || null, data.headline); }} placeholder="Add a headline" maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

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

					<InlineEditable
						canEdit={canEdit}
						isEditing={editingField === "location"}
						onEditStart={() => { setEditLocation(currentLocation || ""); setEditingField("location"); }}
						onCancel={() => setEditingField(null)}
						displayContent={
							<div>
								<FieldLabel label="Location" isPublic />
								<InlinePlaceholder value={currentLocation} placeholder="Add a location">
									<p className="text-base mt-1">{currentLocation}</p>
								</InlinePlaceholder>
							</div>
						}
						editContent={
							<div>
								<FieldLabel label="Location" isPublic />
								<input type="text" value={editLocation} onChange={(e) => { setEditLocation(e.target.value); session?.setDirty("location", e.target.value.trim() || null, data.location); }} placeholder="Add a location" maxLength={200} className={inputClasses} autoFocus />
							</div>
						}
					/>

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
											<span key={i} className="px-3 py-1 bg-melon-green border border-ash-green text-misty-forest text-xs rounded-full">{i}</span>
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
									<TagInputField tags={editInterests} onTagsChange={(tags) => { setEditInterests(tags); session?.setDirty("interests", tags, data.interests); }} placeholder="Type and press Enter" />
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

type EntityData =
	| { type: "user"; data: PersonalUser }
	| { type: "page"; data: PublicPage };

export function PersonalInfoForm() {
	const { activePageId, loading: profileLoading } = useActiveProfile();
	const [entityData, setEntityData] = useState<EntityData | null>(null);
	const [loading, setLoading] = useState(true);

	const isPage = !!activePageId;

	useEffect(() => {
		const url = isPage ? API_ME_PAGE : API_ME_USER;
		fetch(url)
			.then((r) => (r.ok ? r.json() : null))
			.then((data) => {
				if (data) {
					setEntityData(isPage ? { type: "page", data } : { type: "user", data });
				}
			})
			.finally(() => setLoading(false));
	}, [isPage]);

	if (profileLoading || loading) {
		return <p className="text-sm text-dusty-grey text-center py-12">Loading...</p>;
	}

	if (!entityData) {
		return (
			<div className="text-center py-12">
				<p className="text-gray-500 mb-6">Could not load profile data.</p>
				<Link href={SETTINGS} className="text-sm underline text-gray-600">Back to Settings</Link>
			</div>
		);
	}

	const saveUrl = entityData.type === "user" ? API_ME_USER : API_ME_PAGE;

	const handleSave = async (payload: SavePayload) => {
		const res = await authFetch(saveUrl, {
			method: "PUT",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(payload),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		return res.json();
	};

	const title = entityData.type === "user" ? "Personal Info" : "Page Info";
	const subtitle = entityData.type === "user"
		? "Manage your personal information. Fields marked with the eye icon are visible on your public profile."
		: "Manage your page information. Fields marked with the eye icon are visible on the public page.";

	return (
		<div>
			<div className="mb-6">
				<h1 className="text-2xl font-bold">{title}</h1>
				<p className="text-sm text-gray-500 mt-1">{subtitle}</p>
			</div>

			<InlineEditSession
				resource={entityData.data as unknown as Record<string, unknown>}
				onSave={handleSave as (payload: SavePayload) => Promise<Record<string, unknown> | void>}
				onSaved={(updated) =>
					setEntityData((prev) => {
						if (!prev) return prev;
						return prev.type === "user"
							? { type: "user", data: { ...prev.data, ...(updated as Partial<PersonalUser>) } }
							: { type: "page", data: { ...prev.data, ...(updated as Partial<PublicPage>) } };
					})
				}
				canEdit={true}
			>
				{entityData.type === "user" ? (
					<UserFields data={entityData.data} />
				) : (
					<PageFields data={entityData.data} />
				)}
			</InlineEditSession>

			<div className="mt-6 flex justify-center">
				<Link href={SETTINGS} className="text-sm underline text-gray-600">Back to Settings</Link>
			</div>
		</div>
	);
}
