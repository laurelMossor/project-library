"use client";

import { VisibilitySelector, type SelectorOption } from "./VisibilitySelector";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { ProfileVisibility, ContentVisibility } from "@/lib/types/user";

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

	// Sensible default coupling at set-time (fields stay independent afterward): making a profile
	// PRIVATE defaults its content to PRIVATE; making it PUBLIC restores LISTED. Either can be
	// changed independently after.
	function onProfileChange(next: ProfileVisibility) {
		profile.setValue(next);
		if (next === "PRIVATE") content.setValue("PRIVATE");
		else if (content.value === "PRIVATE") content.setValue("LISTED");
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
					options={CONTENT_OPTIONS}
					name="contentVisibility"
					legend="Where your posts appear"
					disabled={!canEdit}
				/>
			</div>
		</div>
	);
}
