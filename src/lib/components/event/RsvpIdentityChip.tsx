"use client";

import Link from "next/link";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { resolveCardIdentity, type CardUser } from "@/lib/types/card";

type RsvpIdentityChipProps = {
	user: CardUser;
	label?: string;
};

/** Small inline identity for member RSVPs and attendee rows — not the large ProfileTag card. */
export function RsvpIdentityChip({ user, label }: RsvpIdentityChipProps) {
	const { name, href } = resolveCardIdentity(user);

	return (
		<div className="flex items-center gap-2.5">
			{label && <span className="text-sm text-dusty-grey shrink-0">{label}</span>}
			<ProfilePicture entity={user} size="sm" asLink />
			<Link href={href} className="text-sm font-medium text-rich-brown hover:underline truncate">
				{name}
			</Link>
		</div>
	);
}
