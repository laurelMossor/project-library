"use client";

import { useState } from "react";
import { ProfileSettingsBase } from "@/lib/components/profile-settings";
import { EditablePageProfile } from "@/lib/components/page/EditablePageProfile";
import { ManageAdmins } from "@/lib/components/connections";
import { PublicPage } from "@/lib/types/page";
import { PUBLIC_PAGE } from "@/lib/const/routes";
import { SettingsSection } from "@/lib/components/profile-settings/SettingsSection";
import { Button } from "@/lib/components/ui/Button";
import type { PageItem } from "@/lib/components/profile-settings/PageSwitcher";

// Page-specific disabled buttons
const PAGE_DISABLED_BUTTONS = [
	"Privacy Settings",
	"Delete Page",
	"Manage Followers",
];

type PageProfileSettingsContentProps = {
	page: PublicPage;
	pages: PageItem[];
};

export function PageProfileSettingsContent({ page, pages }: PageProfileSettingsContentProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [showManageAdmins, setShowManageAdmins] = useState(false);

	const slug = page.slug || "";

	return (
		<>
			<ProfileSettingsBase
				profileType="page"
				pages={pages}
				settingsTitle="Page Settings"
				viewPublicProfileHref={PUBLIC_PAGE(slug)}
				disabledButtons={PAGE_DISABLED_BUTTONS}
				onEditClick={() => setIsEditing(true)}
				isEditing={isEditing}
				profileContent={
					<EditablePageProfile
						page={page}
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
					<ManageAdmins pageId={page.id} />
				</SettingsSection>
			)}
		</>
	);
}
