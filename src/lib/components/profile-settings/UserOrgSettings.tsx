"use client";

import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { ORG_NEW } from "@/lib/const/routes";
import { PeopleGroupIcon } from "@/lib/components/icons/icons";
import { LineDivider } from "../layout/LineDivider";
import { OrgSwitcher, OrgItem } from "./OrgSwitcher";

type UserOrgSettingsProps = {
	orgs?: OrgItem[];
};

/**
 * Org Settings section for user profiles
 * This component should only be displayed when viewing a user profile, not an org profile
 */
export function UserOrgSettings({ orgs }: UserOrgSettingsProps) {
	return (
		<>
			<LineDivider />
			<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
				<PeopleGroupIcon className="w-6 h-6 shrink-0" /> Org Settings
			</h2>
			<div className="flex flex-col gap-3">
				<ButtonLink href={ORG_NEW} variant="secondary" fullWidth>
					Create a Group, Organization, or Public Entity
				</ButtonLink>
				<OrgSwitcher orgs={orgs} showSwitchToUser={false} />
			</div>
		</>
	);
}
