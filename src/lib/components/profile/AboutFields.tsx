"use client";

import { useState } from "react";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";
import { InlineTextField } from "@/lib/components/profile/InlineTextField";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { Tag } from "@/lib/components/tag/Tag";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";

/** Headline, bio, location and interests. Setup and new-page both render these. */
export function AboutFields({
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
				<InlineTextField name="headline" label="Headline" original={headline} placeholder="Add a headline" maxLength={200} visibility="public" optional />
				<InlineEditable
					canEdit={session?.canEdit ?? false}
					isEditing={editing === "bio"}
					onEditStart={() => { setBioDraft(currentBio || ""); setEditing("bio"); }}
					onCancel={() => setEditing(null)}
					displayContent={
						<div>
							<FieldLabel label="Bio" visibility="public" optional />
							<div className="mt-1">
								<InlinePlaceholder value={currentBio} placeholder={bioPlaceholder}>
									<p className="text-base text-gray-600">{currentBio}</p>
								</InlinePlaceholder>
							</div>
						</div>
					}
					editContent={
						<div>
							<FieldLabel label="Bio" visibility="public" optional />
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
				<InlineTextField name="location" label="Location" original={location} placeholder="Add a location" maxLength={200} visibility="public" optional />
				<InlineEditable
					canEdit={session?.canEdit ?? false}
					isEditing={editing === "interests"}
					onEditStart={() => { setInterestDraft(currentInterests); setEditing("interests"); }}
					onCancel={() => setEditing(null)}
					displayContent={
						<div>
							<FieldLabel label="Interests" visibility="public" optional />
							{currentInterests.length > 0 ? (
								<div className="mt-2 flex flex-wrap gap-2">
									{currentInterests.map((interest) => <Tag key={interest} tag={interest} />)}
								</div>
							) : (
								<div className="mt-1">
									<InlinePlaceholder value={null} placeholder="Add interests" />
								</div>
							)}
						</div>
					}
					editContent={
						<div>
							<FieldLabel label="Interests" visibility="public" optional />
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
