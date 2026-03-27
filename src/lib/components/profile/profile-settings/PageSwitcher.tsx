"use client";

import { ButtonLink } from "@/lib/components/ui/ButtonLink";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { PUBLIC_PAGE } from "@/lib/const/routes";

export type PageItem = {
	id: string;
	name: string;
	slug: string;
	avatarImageId?: string | null;
};

type PageSwitcherProps = {
	pages?: PageItem[] | null;
	showSwitchToUser?: boolean;
};

/**
 * Component for displaying a user's pages with links to their public profiles
 */
export function PageSwitcher({ pages }: PageSwitcherProps) {
	if (!pages) {
		return (
			<p className="text-sm text-gray-500 italic">You don&apos;t have any pages yet.</p>
		);
	}

	return (
		<div className="mt-4">
			<p className="text-sm text-gray-600 mb-3">
				Your pages <span className="text-xs text-gray-400">(To edit admins, go to the page profile)</span>
			</p>
			<div className="space-y-2">
				{pages.map((page) => (
					<ProfileTag
						key={page.id}
						page={{
							id: page.id,
							name: page.name,
							slug: page.slug,
							avatarImageId: page.avatarImageId ?? null,
						}}
						actions={
							<ButtonLink
								href={PUBLIC_PAGE(page.slug)}
								variant="secondary"
								size="sm"
							>
								View Page
							</ButtonLink>
						}
					/>
				))}
			</div>
		</div>
	);
}
