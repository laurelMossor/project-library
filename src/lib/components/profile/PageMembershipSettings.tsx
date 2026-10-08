"use client";

import { useInlineField } from "@/lib/hooks/useInlineField";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { MembershipSettingsFields } from "./MembershipSettingsFields";
import type { MembershipPolicy } from "@prisma/client";

/**
 * Membership settings wired into the surrounding InlineEditSession, so they batch
 * with visibility and save on the shared Save bar. Must render inside the session.
 */
export function PageMembershipSettings({
	initialPolicy,
	initialAllowMemberPosts,
}: {
	initialPolicy: MembershipPolicy;
	initialAllowMemberPosts: boolean;
}) {
	const session = useInlineEditSession();
	const policy = useInlineField<MembershipPolicy>("membershipPolicy", initialPolicy);
	const allowPosts = useInlineField<boolean>("allowMemberPosts", initialAllowMemberPosts);

	return (
		<MembershipSettingsFields
			policy={policy.value}
			onPolicyChange={policy.setValue}
			allowMemberPosts={allowPosts.value}
			onAllowMemberPostsChange={allowPosts.setValue}
			disabled={!(session?.canEdit ?? false)}
		/>
	);
}
