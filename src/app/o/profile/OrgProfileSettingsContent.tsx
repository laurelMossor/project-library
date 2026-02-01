"use client";

import { ProfileSettingsBase, OrgItem } from "@/lib/components/profile-settings";
import { OwnerProfileDisplay } from "@/lib/components/owner/OwnerProfileDisplay";
import { ProfileOwner } from "@/lib/types/profile-owner";
import { PUBLIC_ORG_PAGE } from "@/lib/const/routes";

// Org-specific disabled buttons
const ORG_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Manage Admins",
	"Delete Organization",
	"Manage Followers",
];

type OrgProfileSettingsContentProps = {
	org: ProfileOwner;
	orgs: OrgItem[];
};

export function OrgProfileSettingsContent({ org, orgs }: OrgProfileSettingsContentProps) {
	// Get the slug from the org data
	const slug = org.type === "ORG" ? org.data.slug : "";

	return (
		<ProfileSettingsBase
			ownerType="org"
			orgs={orgs}
			settingsTitle="Org Settings"
			viewPublicProfileHref={PUBLIC_ORG_PAGE(slug)}
			disabledButtons={ORG_DISABLED_BUTTONS}
			profileContent={<OwnerProfileDisplay owner={org} />}
		/>
	);
}
