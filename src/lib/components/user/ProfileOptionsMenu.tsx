"use client";

import { useState } from "react";
import { DropdownMenu, dropdownMenuStyles } from "../ui/DropdownMenu";
import { MenuItem } from "../nav-bar/hamburger/MenuItem";
import { GearsIcon, PencilIcon, CalendarIcon, UserHomeIcon } from "../icons/icons";
import { PRIVATE_USER_PAGE, PROJECT_NEW, EVENT_NEW, USER_PROFILE_SETTINGS } from "@/lib/const/routes";

const iconClass = "w-6 h-6 shrink-0";

export function ProfileOptionsMenu() {
	const [isOpen, setIsOpen] = useState(false);

	const closeMenu = () => {
		setIsOpen(false);
	};

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={() => setIsOpen((o) => !o)}
			trigger={
				<span className="flex items-center gap-2">
					<GearsIcon className="w-6 h-6 shrink-0" />
					<span>Options</span>
				</span>
			}
			triggerClassName="flex items-center gap-2 px-3 py-2 text-rich-brown hover:opacity-80 rounded transition-opacity"
			triggerAriaLabel="Profile options"
		>
			<MenuItem
				icon={<UserHomeIcon className={iconClass} />}
				label="Edit Profile"
				href={PRIVATE_USER_PAGE}
				closeMenu={closeMenu}
			/>

			<MenuItem
				icon={<PencilIcon className={iconClass} />}
				label="New Project"
				href={PROJECT_NEW}
				closeMenu={closeMenu}
			/>

			<MenuItem
				icon={<CalendarIcon className={iconClass} />}
				label="New Event"
				href={EVENT_NEW}
				closeMenu={closeMenu}
			/>

			<div className={dropdownMenuStyles.divider} />

			<MenuItem
				icon={<GearsIcon className={iconClass} />}
				label="Settings"
				href={USER_PROFILE_SETTINGS}
				closeMenu={closeMenu}
			/>
		</DropdownMenu>
	);
}
