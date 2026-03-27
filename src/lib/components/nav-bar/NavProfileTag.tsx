"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { MenuItem } from "./hamburger/MenuItem";
import { CardUser, CardPage } from "@/lib/types/card";
import { API_ME_USER, API_ME_PAGE, PUBLIC_USER_PAGE, PUBLIC_PAGE } from "@/lib/const/routes";
import { hasSession } from "@/lib/utils/auth-client";
import { UserHomeIcon } from "@/lib/components/icons/icons";
import { Session } from "next-auth";

interface NavProfileTagProps {
	session: Session | null;
}

export function NavProfileTag({ session: sessionProp }: NavProfileTagProps) {
	const { data: session } = useSession();
	const activeSession = session || sessionProp;
	const isLoggedIn = hasSession(activeSession);

	const [isOpen, setIsOpen] = useState(false);
	const [entity, setEntity] = useState<{ type: "user"; data: CardUser } | { type: "page"; data: CardPage } | null>(null);
	const [profileLink, setProfileLink] = useState<string | undefined>(undefined);

	useEffect(() => {
		if (!isLoggedIn) return;
		const activePageId = activeSession?.user?.activePageId;
		if (activePageId) {
			fetch(API_ME_PAGE)
				.then((r) => (r.ok ? r.json() : null))
				.then((page) => {
					if (page?.id) {
						setEntity({ type: "page", data: page as CardPage });
						setProfileLink(PUBLIC_PAGE(page.slug));
					}
				})
				.catch(() => {});
		} else {
			fetch(API_ME_USER)
				.then((r) => (r.ok ? r.json() : null))
				.then((user) => {
					if (user?.id) {
						setEntity({ type: "user", data: user as CardUser });
						setProfileLink(PUBLIC_USER_PAGE(user.username));
					}
				})
				.catch(() => {});
		}
	}, [isLoggedIn, activeSession?.user?.activePageId]);

	if (!isLoggedIn || !entity) return null;

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={() => setIsOpen((o) => !o)}
			triggerClassName="cursor-pointer rounded transition-opacity hover:opacity-80"
			triggerAriaLabel="Profile menu"
			trigger={
				entity.type === "user"
					? <ProfileTag user={entity.data} size="md" className="border-none bg-transparent hover:bg-transparent" />
					: <ProfileTag page={entity.data} size="md" className="border-none bg-transparent hover:bg-transparent" />
			}
		>
			<MenuItem
				icon={<UserHomeIcon className="w-6 h-6 shrink-0" />}
				label="View Profile"
				href={profileLink}
				closeMenu={() => setIsOpen(false)}
			/>
		</DropdownMenu>
	);
}
