"use client";

import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { PAGE_NEW } from "@/lib/const/routes";
import { PeopleGroupIcon } from "@/lib/components/icons/icons";
import { LineDivider } from "../../layout/LineDivider";
import { PageSwitcher, PageItem } from "./PageSwitcher";

type UserPageSettingsProps = {
	pages?: PageItem[];
};

/**
 * Page Settings section for user profiles
 * This component should only be displayed when viewing a user profile, not a page profile
 */
export function UserPageSettings({ pages }: UserPageSettingsProps) {
	return (
		<>
			<LineDivider />
			<h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
				<PeopleGroupIcon className="w-6 h-6 shrink-0" /> Page Settings
			</h2>
			<div className="flex flex-col gap-3">
				<ButtonLink href={PAGE_NEW} variant="secondary" fullWidth>
					Create a Group, Organization, or Public Entity
				</ButtonLink>
				<PageSwitcher pages={pages} showSwitchToUser={false} />
			</div>
		</>
	);
}
