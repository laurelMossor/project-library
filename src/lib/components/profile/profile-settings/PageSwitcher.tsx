"use client";

import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { formatRole } from "@/lib/const/roles";

export type PageItem = {
	id: string;
	name: string;
	handle: string;
	avatarImageId?: string | null;
	avatarImage?: { url: string } | null;
	role?: string;
};

type PageSwitcherProps = {
	pages?: PageItem[] | null;
	showSwitchToUser?: boolean;
};

export function PageSwitcher({ pages }: PageSwitcherProps) {
	if (!pages) {
		return (
			<p className="text-sm text-gray-500 italic">You don&apos;t have any pages yet.</p>
		);
	}

	return (
		<div className="mt-4">
			<p className="text-sm text-gray-600 mb-3">Your pages</p>
			<div className="space-y-2">
				{pages.map((page) => (
					<ProfileTag
						key={page.id}
						entity={{
							id: page.id,
							name: page.name,
							handle: page.handle,
							avatarImageId: page.avatarImageId ?? null,
							avatarImage: page.avatarImage,
						}}
						badge={page.role ? formatRole(page.role) : undefined}
					/>
				))}
			</div>
		</div>
	);
}
