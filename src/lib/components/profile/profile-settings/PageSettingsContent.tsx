"use client";

import { useState } from "react";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings/ProfileSettingsBase";
import { ManageAdmins } from "@/lib/components/connections/ManageAdmins";
import { PublicPage } from "@/lib/types/page";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { Button } from "@/lib/components/ui/Button";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";
import { CONNECTIONS } from "@/lib/const/routes";

const PAGE_DISABLED_BUTTONS = ["Privacy Settings", "Delete Page"];

type PageSettingsContentProps = {
	page: PublicPage;
	pages: PageItem[];
	publicProfileHref: string;
};

export function PageSettingsContent({
	page,
	pages,
	publicProfileHref,
}: PageSettingsContentProps) {
	const [showManageAdmins, setShowManageAdmins] = useState(false);

	return (
		<>
			<ProfileSettingsBase
				profileType="page"
				pages={pages}
				settingsTitle="Page Settings"
				viewPublicProfileHref={publicProfileHref}
				viewPublicProfileLabel="View & Edit Profile"
				disabledButtons={PAGE_DISABLED_BUTTONS}
				additionalSettingsButtons={
					<>
						<ButtonLink href={CONNECTIONS} variant="secondary" fullWidth>
							Manage Connections
						</ButtonLink>
						<Button
							onClick={() => setShowManageAdmins(!showManageAdmins)}
							variant="secondary"
							fullWidth
						>
							{showManageAdmins ? "Hide Admin Management" : "Manage Admins"}
						</Button>
					</>
				}
			/>

			{showManageAdmins && (
				<SettingsSection>
					<ManageAdmins pageId={page.id} />
				</SettingsSection>
			)}
		</>
	);
}
