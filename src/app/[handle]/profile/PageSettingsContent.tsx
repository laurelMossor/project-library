"use client";

import { useState } from "react";
import { ProfileSettingsBase } from "@/lib/components/profile/profile-settings";
import { ManageAdmins } from "@/lib/components/connections";
import { PublicPage } from "@/lib/types/page";
import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { SettingsSection } from "@/lib/components/profile/profile-settings/SettingsSection";
import { Button } from "@/lib/components/ui/Button";
import type { PageItem } from "@/lib/components/profile/profile-settings/PageSwitcher";

const PAGE_DISABLED_BUTTONS = ["Privacy Settings", "Delete Page"];

type PageSettingsContentProps = {
	page: PublicPage;
	pages: PageItem[];
	publicProfileHref: string;
	connectionsHref: string;
};

export function PageSettingsContent({
	page,
	pages,
	publicProfileHref,
	connectionsHref,
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
						<ButtonLink href={connectionsHref} variant="secondary" fullWidth>
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
