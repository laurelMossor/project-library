"use client";

import { VisibilitySelector, type SelectorOption } from "./VisibilitySelector";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { ProfileVisibility, ContentVisibility } from "@prisma/client";

const PROFILE_OPTIONS: SelectorOption<ProfileVisibility>[] = [
	{
		value: "PUBLIC",
		label: "Public",
		description: "Your full profile is visible to anyone and discoverable in search.",
	},
	{
		value: "PRIVATE",
		label: "Private",
		description: "Still discoverable, but people see only your name and can request to connect.",
	},
];

const CONTENT_OPTIONS: SelectorOption<ContentVisibility>[] = [
	{
		value: "LISTED",
		label: "Listed",
		description: "Your posts appear in Explore and on your profile.",
	},
	{
		value: "UNLISTED",
		label: "Unlisted",
		description: "Your posts show only on your profile, not in Explore.",
	},
	{
		value: "PRIVATE",
		label: "Private",
		description: "Your posts are visible only to your connections.",
	},
];

type Props = {
	/** Section label, e.g. "Profile Visibility" or "Page Visibility". */
	label: string;
	initialProfileVisibility: ProfileVisibility;
	initialContentVisibility: ContentVisibility;
};

/**
 * The two independent visibility controls (profile access + content distribution) wired into
 * the surrounding InlineEditSession: changes batch with every other field and save via the
 * shared Save bar. Shared by user and page profiles so the two stay in lockstep.
 */
export function VisibilityField({ label, initialProfileVisibility, initialContentVisibility }: Props) {
	const session = useInlineEditSession();
	const canEdit = session?.canEdit ?? false;
	const profile = useInlineField<ProfileVisibility>("profileVisibility", initialProfileVisibility);
	const content = useInlineField<ContentVisibility>("contentVisibility", initialContentVisibility);

	// The two fields are independent EXCEPT for one guard: a PRIVATE profile can't have LISTED
	// content (a locked profile whose posts flood public feeds is incoherent). While the profile
	// is private, Listed is removed from the content options, and switching to private snaps a
	// currently-Listed default down to Private (a narrowing — never a widen). Switching back to
	// public re-enables Listed and leaves the content value untouched (no forced reset — this is
	// what removes the old silent mass-widening on save).
	const isPrivateProfile = profile.value === "PRIVATE";
	const contentOptions = isPrivateProfile
		? CONTENT_OPTIONS.filter((o) => o.value !== "LISTED")
		: CONTENT_OPTIONS;

	function onProfileChange(next: ProfileVisibility) {
		profile.setValue(next);
		if (next === "PRIVATE" && content.value === "LISTED") content.setValue("PRIVATE");
	}

	return (
		<div className="border-t border-gray-100 pt-4 space-y-6">
			<div>
				<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">{label}</p>
				<VisibilitySelector
					value={profile.value}
					onChange={onProfileChange}
					options={PROFILE_OPTIONS}
					name="profileVisibility"
					legend="Who can see this profile"
					disabled={!canEdit}
				/>
			</div>
			<div>
				<VisibilitySelector
					value={content.value}
					onChange={content.setValue}
					options={contentOptions}
					name="contentVisibility"
					legend="Where your posts appear"
					disabled={!canEdit}
				/>
			</div>
		</div>
	);
}
