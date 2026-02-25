"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DropdownMenu, dropdownMenuStyles } from "../ui/DropdownMenu";
import { MenuItem } from "../nav-bar/hamburger/MenuItem";
import { GearsIcon, PencilIcon, CalendarIcon, UserHomeIcon, PeopleGroupIcon } from "../icons/icons";
import { PROJECT_NEW, EVENT_NEW, ORG_PROFILE_SETTINGS, API_ME_OWNER, PRIVATE_ORG_PAGE } from "@/lib/const/routes";
import { transparentCTAStyles } from "../collection/CreationCTA";

const iconClass = "w-6 h-6 shrink-0";

type OrgProfileOptionsMenuProps = {
	isActingAsThisOrg?: boolean;
	orgOwnerId?: string;
};

/**
 * Options menu for org public profile page (o/[slug])
 * - When acting as this org: Shows full options (Edit, New Project, New Event, Settings)
 * - When NOT acting as this org (but is admin): Shows only "Switch to Org Profile"
 */
export function OrgProfileOptionsMenu({ isActingAsThisOrg: serverIsActingAsThisOrg = false, orgOwnerId }: OrgProfileOptionsMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [switching, setSwitching] = useState(false);
	const router = useRouter();
	const { data: session, update: updateSession } = useSession();
	
	// Check client-side session to ensure we have the most up-to-date state
	// This handles cases where the session updates client-side after switching
	// Priority: client session check > server prop
	let isActingAsThisOrg = serverIsActingAsThisOrg;
	
	if (orgOwnerId && session?.user) {
		// Client session is available - use it as source of truth
		// activeOwnerId can be a string (acting as org) or null (acting as user)
		const activeOwnerId = session.user.activeOwnerId;
		isActingAsThisOrg = activeOwnerId !== null && activeOwnerId !== undefined && activeOwnerId === orgOwnerId;
	}

	const closeMenu = () => {
		setIsOpen(false);
	};

	const handleSwitchToOrg = async () => {
		if (!orgOwnerId) return;
		
		setSwitching(true);
		try {
			const res = await fetch(API_ME_OWNER, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ ownerId: orgOwnerId }),
			});

			if (res.ok) {
				await updateSession({ activeOwnerId: orgOwnerId });
				closeMenu();
				// Refresh the page to update the server-side props
				router.refresh();
			}
		} catch (err) {
			// Silently fail
		} finally {
			setSwitching(false);
		}
	};

	// When NOT acting as this org, show only "Switch to Org Profile" option
	if (!isActingAsThisOrg) {
		return (
			<DropdownMenu
				isOpen={isOpen}
				onClose={() => setIsOpen((o) => !o)}
				trigger={
					<>
						<span className={transparentCTAStyles.iconWrapper}>
							<GearsIcon className="w-6 h-6 shrink-0" />
						</span>
						<span className={transparentCTAStyles.label}>Options</span>
					</>
				}
				triggerClassName={transparentCTAStyles.container}
				triggerAriaLabel="Org profile options"
			>
				<MenuItem
					icon={<PeopleGroupIcon className={iconClass} />}
					label={switching ? "Switching..." : "Switch to Org Profile"}
					onClick={handleSwitchToOrg}
					closeMenu={() => {}}
				/>
			</DropdownMenu>
		);
	}

	// When acting as this org, show full options menu
	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={() => setIsOpen((o) => !o)}
			trigger={
				<>
					<span className={transparentCTAStyles.iconWrapper}>
						<GearsIcon className="w-6 h-6 shrink-0" />
					</span>
					<span className={transparentCTAStyles.label}>Options</span>
				</>
			}
			triggerClassName={transparentCTAStyles.container}
			triggerAriaLabel="Org profile options"
		>
			<MenuItem
				icon={<UserHomeIcon className={iconClass} />}
				label="Edit Profile"
				href={`${ORG_PROFILE_SETTINGS}#profile-section`}
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
				href={ORG_PROFILE_SETTINGS}
				closeMenu={closeMenu}
			/>
		</DropdownMenu>
	);
}
