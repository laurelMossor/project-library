"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { ActiveIdentityEditor } from "@/lib/components/profile/ActiveIdentityEditor";
import { ClickableProfilePicture } from "@/lib/components/profile/ClickableProfilePicture";
import { HandleEditor } from "@/lib/components/profile/HandleEditor";
import { InlineTextField } from "@/lib/components/profile/InlineTextField";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";
import { VisibilityField } from "@/lib/components/visibility/VisibilityField";
import { PageMembershipSettings } from "@/lib/components/profile/PageMembershipSettings";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { NotificationSettingsForm } from "@/app/settings/profile/NotificationSettingsForm";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { Tag } from "@/lib/components/tag/Tag";
import { Button } from "@/lib/components/ui/Button";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { API_ME_PAGE_HANDLE, API_ME_SETUP_COMPLETE, EXPLORE_PAGE, PUBLIC_PROFILE } from "@/lib/const/routes";
import type { CardEntity } from "@/lib/types/card";
import type { IdentityEntity } from "@/lib/components/profile/ActiveIdentityEditor";
import type { PublicPage } from "@/lib/types/page";
import type { PublicUser } from "@/lib/types/user";

export function SetupClient({ next }: { next: string }) {
	const { activePageId } = useActiveProfile();
	const isPage = !!activePageId;

	return (
		<div className="mx-auto w-full max-w-2xl px-4 py-10">
			<h1 className="text-2xl font-bold mb-2">Set up your account</h1>
			<p className="text-sm text-gray-500 mb-8">
				Pick a handle first. It is your URL. The name under it starts as that handle — change it, or leave it and it stays the handle.
			</p>
			<ActiveIdentityEditor footer="none">
				{(entity, { merge }) => (
					<SetupFields entity={entity} merge={merge} next={next} isPage={isPage} />
				)}
			</ActiveIdentityEditor>
		</div>
	);
}

function SetupFields({
	entity,
	merge,
	next,
	isPage,
}: {
	entity: IdentityEntity;
	merge: (patch: Record<string, unknown>) => void;
	next: string;
	isPage: boolean;
}) {
	const session = useInlineEditSession();
	const router = useRouter();
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [handle, setHandle] = useState(entity.data.handle);
	const card: CardEntity = entity.type === "page"
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
			avatarImageId: entity.data.avatarImageId,
			avatarImage: entity.data.avatarImage,
		};

	async function looksGood() {
		setBusy(true);
		setError(null);
		try {
			await session?.saveAll();
			if (isPage) {
				router.push(PUBLIC_PROFILE(handle));
				return;
			}
			const res = await fetch(API_ME_SETUP_COMPLETE, { method: "POST" });
			if (!res.ok) throw new Error("Couldn't finish setup");
			router.refresh();
			router.replace(next || EXPLORE_PAGE);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Couldn't finish setup");
			setBusy(false);
		}
	}

	return (
		<div>
			<div className="space-y-4 mb-6">
				<HandleEditor
					initialHandle={entity.data.handle}
					endpoint={isPage ? API_ME_PAGE_HANDLE : undefined}
					highlight
					onSaved={setHandle}
				/>
				<SetupNameField
					name={entity.type === "page" ? "name" : "displayName"}
					label={entity.type === "page" ? "Page Name" : "Display Name"}
					stored={entity.type === "page" ? entity.data.name : entity.data.displayName}
					handle={handle}
				/>
			</div>

			<SettingsSection title="Profile photo">
				<ClickableProfilePicture
					entity={card}
					canEdit
					onSaved={(avatar) => merge({
						avatarImageId: avatar?.id ?? null,
						avatarImage: avatar ? { url: avatar.url } : null,
					})}
				/>
			</SettingsSection>

			{entity.type === "user" ? (
				<UserSetupFields data={entity.data} />
			) : (
				<PageSetupFields data={entity.data} />
			)}

			<VisibilityField
				profileSectionTitle={entity.type === "page" ? "Page Visibility" : "Profile Visibility"}
				contentSectionTitle="Content Visibility"
				initialProfileVisibility={entity.data.profileVisibility ?? "PUBLIC"}
				initialContentVisibility={entity.data.contentVisibility ?? "LISTED"}
			/>
			{entity.type === "page" && (
				<PageMembershipSettings
					initialPolicy={entity.data.membershipPolicy ?? "CLOSED"}
					initialAllowMemberPosts={entity.data.allowMemberPosts ?? false}
				/>
			)}

			<SettingsSection title="Email notifications">
				<NotificationSettingsForm />
			</SettingsSection>

			{error && <p role="alert" className="text-sm text-novel-red mb-4">{error}</p>}
			<Button onClick={looksGood} loading={busy}>Looks good</Button>
		</div>
	);
}

/**
 * The name starts as the handle and keeps following it until the person types
 * something else. Leaving it untouched saves the handle as the name.
 */
function SetupNameField({
	name,
	label,
	stored,
	handle,
}: {
	name: "name" | "displayName";
	label: string;
	stored: string | null;
	handle: string;
}) {
	const session = useInlineEditSession();
	const [custom, setCustom] = useState<string | null>(null);
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(handle);
	const shown = custom ?? handle;
	const setDirty = session?.setDirty;

	useEffect(() => {
		setDirty?.(name, shown, stored);
	}, [setDirty, name, shown, stored]);

	return (
		<div className="rounded-md ring-2 ring-rich-brown p-3">
			<InlineEditable
				canEdit={session?.canEdit ?? false}
				isEditing={editing}
				onEditStart={() => { setDraft(shown); setEditing(true); }}
				onCancel={() => setEditing(false)}
				displayContent={
					<div>
						<FieldLabel label={label} isPublic />
						<p className="text-base mt-1">{shown}</p>
						{custom === null && (
							<p className="text-xs text-dusty-grey mt-1">Using your handle. Change it, or leave it.</p>
						)}
					</div>
				}
				editContent={
					<div>
						<FieldLabel label={label} isPublic />
						<input
							type="text"
							value={draft}
							onChange={(e) => {
								const next = e.target.value;
								setDraft(next);
								const trimmed = next.trim();
								setCustom(trimmed === handle ? null : trimmed);
							}}
							maxLength={100}
							autoFocus
							className="w-full text-base border-b border-gray-300 py-1 mt-1 focus:outline-none focus:border-rich-brown bg-transparent"
						/>
					</div>
				}
			/>
		</div>
	);
}

function UserSetupFields({ data }: { data: PublicUser }) {
	const email = (data as PublicUser & { email?: string }).email;
	return (
		<>
			<SettingsSection title="Personal information">
				{email && (
					<div className="mb-4">
						<FieldLabel label="Email" />
						<p className="text-base text-warm-grey mt-1">{email}</p>
					</div>
				)}
				<div className="space-y-4">
					<InlineTextField name="firstName" label="First Name" original={data.firstName} placeholder="Add first name" />
					<InlineTextField name="middleName" label="Middle Name" original={data.middleName} placeholder="Add middle name" />
					<InlineTextField name="lastName" label="Last Name" original={data.lastName} placeholder="Add last name" />
				</div>
			</SettingsSection>
			<AboutFields
				headline={data.headline}
				bio={data.bio}
				location={data.location}
				interests={data.interests}
				bioPlaceholder="Tell people about yourself"
			/>
		</>
	);
}

function PageSetupFields({ data }: { data: PublicPage }) {
	return (
		<>
			<AboutFields
				headline={data.headline}
				bio={data.bio}
				location={data.location}
				interests={data.interests}
				bioPlaceholder="Describe this page"
			/>
			<SettingsSection title="Address">
				<div className="space-y-4">
					<InlineTextField name="addressLine1" label="Address Line 1" original={data.addressLine1} placeholder="Street address" maxLength={200} />
					<InlineTextField name="addressLine2" label="Address Line 2" original={data.addressLine2} placeholder="Apt, suite, etc." maxLength={200} />
					<InlineTextField name="city" label="City" original={data.city} placeholder="City" />
					<InlineTextField name="state" label="State" original={data.state} placeholder="State" />
					<InlineTextField name="zip" label="ZIP" original={data.zip} placeholder="ZIP" />
				</div>
			</SettingsSection>
		</>
	);
}

function AboutFields({
	headline,
	bio,
	location,
	interests,
	bioPlaceholder,
}: {
	headline: string | null;
	bio: string | null;
	location: string | null;
	interests: string[];
	bioPlaceholder: string;
}) {
	const session = useInlineEditSession();
	const [editing, setEditing] = useState<"bio" | "interests" | null>(null);
	const [bioDraft, setBioDraft] = useState(bio ?? "");
	const [interestDraft, setInterestDraft] = useState(interests);
	const currentBio = (session?.dirtyFields.bio as string | null | undefined) ?? bio;
	const currentInterests = (session?.dirtyFields.interests as string[] | undefined) ?? interests;

	return (
		<SettingsSection title="Public profile">
			<div className="space-y-4">
				<InlineTextField name="headline" label="Headline" original={headline} placeholder="Add a headline" maxLength={200} isPublic />
				<InlineEditable
					canEdit={session?.canEdit ?? false}
					isEditing={editing === "bio"}
					onEditStart={() => { setBioDraft(currentBio || ""); setEditing("bio"); }}
					onCancel={() => setEditing(null)}
					displayContent={
						<div>
							<FieldLabel label="Bio" isPublic />
							<InlinePlaceholder value={currentBio} placeholder={bioPlaceholder}>
								<p className="text-base text-gray-600 mt-1">{currentBio}</p>
							</InlinePlaceholder>
						</div>
					}
					editContent={
						<div>
							<FieldLabel label="Bio" isPublic />
							<textarea
								value={bioDraft}
								onChange={(e) => {
									setBioDraft(e.target.value);
									session?.setDirty("bio", e.target.value.trim() || null, bio);
								}}
								placeholder={bioPlaceholder}
								rows={4}
								maxLength={2000}
								autoFocus
								className="w-full border border-gray-300 rounded-lg p-2 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown mt-1"
							/>
						</div>
					}
				/>
				<InlineTextField name="location" label="Location" original={location} placeholder="Add a location" maxLength={200} isPublic />
				<InlineEditable
					canEdit={session?.canEdit ?? false}
					isEditing={editing === "interests"}
					onEditStart={() => { setInterestDraft(currentInterests); setEditing("interests"); }}
					onCancel={() => setEditing(null)}
					displayContent={
						<div>
							<FieldLabel label="Interests" isPublic />
							{currentInterests.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{currentInterests.map((interest) => <Tag key={interest} tag={interest} />)}
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
								<TagInputField
									tags={interestDraft}
									onTagsChange={(tags) => {
										setInterestDraft(tags);
										session?.setDirty("interests", tags, interests);
									}}
								/>
							</div>
						</div>
					}
				/>
			</div>
		</SettingsSection>
	);
}
