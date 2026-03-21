"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { DropdownMenu, dropdownMenuStyles } from "../ui/DropdownMenu";
import { MenuItem } from "../nav-bar/hamburger/MenuItem";
import { GearsIcon, PencilIcon, CalendarIcon, UserHomeIcon, PeopleGroupIcon } from "../icons/icons";
import { EVENT_NEW, PAGE_PROFILE_SETTINGS, API_ME_PAGE, PRIVATE_PAGE } from "@/lib/const/routes";
import { transparentCTAStyles } from "../collection/CreationCTA";

const iconClass = "w-6 h-6 shrink-0";

type PageProfileOptionsMenuProps = {
	isActingAsThisPage?: boolean;
	pageId?: string;
};

/**
 * Options menu for page public profile page (p/[slug])
 * - When acting as this page: Shows full options (Edit Profile, New Event, Settings)
 * - When NOT acting as this page (but is admin): Shows only "Switch to Page"
 */
export function PageProfileOptionsMenu({ isActingAsThisPage: serverIsActingAsThisPage = false, pageId }: PageProfileOptionsMenuProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [switching, setSwitching] = useState(false);
	const router = useRouter();
	const { data: session, update: updateSession } = useSession();

	// Check client-side session to ensure we have the most up-to-date state
	let isActingAsThisPage = serverIsActingAsThisPage;

	if (pageId && session?.user) {
		const activePageId = session.user.activePageId;
		isActingAsThisPage = activePageId !== null && activePageId !== undefined && activePageId === pageId;
	}

	const closeMenu = () => {
		setIsOpen(false);
	};

	const handleSwitchToPage = async () => {
		if (!pageId) return;

		setSwitching(true);
		try {
			const res = await fetch(API_ME_PAGE, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ activePageId: pageId }),
			});

			if (res.ok) {
				await updateSession({ activePageId: pageId });
				closeMenu();
				router.refresh();
			}
		} catch (err) {
			// Silently fail
		} finally {
			setSwitching(false);
		}
	};

	// When NOT acting as this page, show only "Switch to Page" option
	if (!isActingAsThisPage) {
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
				triggerAriaLabel="Page profile options"
			>
				<MenuItem
					icon={<PeopleGroupIcon className={iconClass} />}
					label={switching ? "Switching..." : "Switch to Page"}
					onClick={handleSwitchToPage}
					closeMenu={() => {}}
				/>
			</DropdownMenu>
		);
	}

	// When acting as this page, show full options menu
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
			triggerAriaLabel="Page profile options"
		>
			<MenuItem
				icon={<UserHomeIcon className={iconClass} />}
				label="Edit Profile"
				href={`${PAGE_PROFILE_SETTINGS}#profile-section`}
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
				href={PAGE_PROFILE_SETTINGS}
				closeMenu={closeMenu}
			/>
		</DropdownMenu>
	);
}
