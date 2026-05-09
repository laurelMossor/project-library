"use client";

import Link from "next/link";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

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
					<Link key={page.id} href={PUBLIC_PROFILE(page.handle)}>
						<ProfileTag
							entity={{
								id: page.id,
								name: page.name,
								handle: page.handle,
								avatarImageId: page.avatarImageId ?? null,
								avatarImage: page.avatarImage,
							}}
							badge={page.role?.toLowerCase()}
							asLink={false}
						/>
					</Link>
				))}
			</div>
		</div>
	);
}
