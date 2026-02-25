"use client";

import { useState } from "react";
import { ProfileSettingsBase, OrgItem } from "@/lib/components/profile-settings";
import { EditableOrgProfile } from "@/lib/components/org/EditableOrgProfile";
import { ManageAdmins } from "@/lib/components/connections";
import { PublicOrg } from "@/lib/types/org";
import { PUBLIC_ORG_PAGE } from "@/lib/const/routes";
import { SettingsSection } from "@/lib/components/profile-settings/SettingsSection";
import { Button } from "@/lib/components/ui/Button";

// Org-specific disabled buttons (Manage Admins is now functional)
const ORG_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Delete Organization",
	"Manage Followers",
];

type OrgProfileSettingsContentProps = {
	org: PublicOrg;
	orgs: OrgItem[];
};

export function OrgProfileSettingsContent({ org, orgs }: OrgProfileSettingsContentProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [showManageAdmins, setShowManageAdmins] = useState(false);

	// Get the slug from the org data
	const slug = org.slug || "";

	return (
		<>
			<ProfileSettingsBase
				ownerType="org"
				orgs={orgs}
				settingsTitle="Org Settings"
				viewPublicProfileHref={PUBLIC_ORG_PAGE(slug)}
				disabledButtons={ORG_DISABLED_BUTTONS}
				onEditClick={() => setIsEditing(true)}
				isEditing={isEditing}
				profileContent={
					<EditableOrgProfile 
						org={org} 
						isEditing={isEditing}
						onEditingChange={setIsEditing}
					/>
				}
				additionalSettingsButtons={
					<Button
						onClick={() => setShowManageAdmins(!showManageAdmins)}
						variant="secondary"
						fullWidth
					>
						{showManageAdmins ? "Hide Admin Management" : "Manage Admins"}
					</Button>
				}
			/>

			{/* Admin Management Section */}
			{showManageAdmins && (
				<SettingsSection>
					<ManageAdmins orgId={org.id} />
				</SettingsSection>
			)}
		</>
	);
}
