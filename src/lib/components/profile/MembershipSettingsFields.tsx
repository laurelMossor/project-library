"use client";

import { VisibilitySelector, type SelectorOption } from "@/lib/components/visibility/VisibilitySelector";
import { Toggle } from "@/lib/components/forms/Toggle";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import type { MembershipPolicy } from "@prisma/client";

/** Policies the UI offers. OPEN exists in the enum but isn't available yet. */
export const MEMBERSHIP_POLICY_OPTIONS: SelectorOption<MembershipPolicy>[] = [
	{
		value: "CLOSED",
		label: "No Membership",
		description: "Approved followers see what this page posts, including private posts. There are no members, so nobody posts to this page.",
	},
	{
		value: "INVITE_ONLY",
		label: "Invite only",
		description: "People become members only when an admin invites them and they accept.",
	},
	{
		value: "REQUEST_TO_JOIN",
		label: "Request to join",
		description: "Anyone can ask to join. An admin approves each request. Admins can still invite.",
	},
];

type Props = {
	policy: MembershipPolicy;
	onPolicyChange: (next: MembershipPolicy) => void;
	allowMemberPosts: boolean;
	onAllowMemberPostsChange: (next: boolean) => void;
	disabled?: boolean;
	/** Radio group name — unique per form. */
	name?: string;
};

/**
 * Membership policy + the member-posts toggle. Shared by page settings (inside an
 * InlineEditSession) and the create-page form. The toggle is off and disabled while
 * the page is Closed, because a page with no members has nothing to post to.
 */
export function MembershipSettingsFields({
	policy,
	onPolicyChange,
	allowMemberPosts,
	onAllowMemberPostsChange,
	disabled = false,
	name = "membershipPolicy",
}: Props) {
	const closed = policy === "CLOSED";

	function changePolicy(next: MembershipPolicy) {
		onPolicyChange(next);
		if (next === "CLOSED") onAllowMemberPostsChange(false);
	}

	return (
		<SettingsSection title="Membership">
			<VisibilitySelector
				name={name}
				legend="Who can be a member"
				value={policy}
				onChange={changePolicy}
				options={MEMBERSHIP_POLICY_OPTIONS}
				disabled={disabled}
			/>
			<Toggle
				label="Members can post"
				description={
					closed
						? "Turn membership on to let members post to this page."
						: "Members post to this page as themselves. Their name shows with the page."
				}
				checked={closed ? false : allowMemberPosts}
				onChange={onAllowMemberPostsChange}
				disabled={disabled || closed}
			/>
		</SettingsSection>
	);
}
