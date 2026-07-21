"use client";

import { useState, useCallback } from "react";
import { DropdownMenu, dropdownMenuStyles } from "@/lib/components/ui/DropdownMenu";
import { BellIcon } from "@/lib/components/icons/icons";
import { NotificationDot } from "@/lib/components/ui/NotificationDot";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { API_NOTIFICATIONS, API_NOTIFICATIONS_READ } from "@/lib/const/routes";
import type { NotificationItem } from "@/lib/types/notification";
import { useNotificationCount } from "./NotificationContext";
import { NotificationRow } from "./NotificationRow";

/**
 * Nav bell for the active identity's activity notifications. The dot reflects the active identity's
 * unread count (the profile switcher carries dots for the others). Opening fetches that identity's
 * latest notifications and marks them read.
 */
export function NotificationBell() {
	const { activeCount } = useNotificationCount();
	const { activePageId } = useActiveProfile();
	const [isOpen, setIsOpen] = useState(false);
	const [items, setItems] = useState<NotificationItem[] | null>(null);

	const context = activePageId ?? "personal";

	const loadAndMarkRead = useCallback(async () => {
		setItems(null);
		try {
			const res = await fetch(`${API_NOTIFICATIONS}?context=${encodeURIComponent(context)}`);
			const data = res.ok ? await res.json() : { items: [] };
			setItems(data.items ?? []);
			// Mark this identity's unread as read on open, then let the shared hook refresh the badge.
			if (activeCount > 0) {
				await fetch(API_NOTIFICATIONS_READ, {
					method: "PATCH",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ context }),
				});
				window.dispatchEvent(new Event("notifications:read"));
			}
		} catch {
			setItems([]);
		}
	}, [context, activeCount]);

	// DropdownMenu calls onClose as a toggle (matches the hamburger/profile-switcher usage).
	const toggle = () => {
		setIsOpen((open) => {
			const next = !open;
			if (next) void loadAndMarkRead();
			return next;
		});
	};

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={toggle}
			triggerAriaLabel="Notifications"
			containerClassName="w-[340px] max-w-[90vw]"
			trigger={
				<div className="relative">
					<BellIcon className="w-6 h-6 shrink-0" />
					{activeCount > 0 && (
						<span className="absolute -top-0.5 -right-0.5">
							<NotificationDot label={`${activeCount} unread notifications`} />
						</span>
					)}
				</div>
			}
		>
			<div className="px-4 pb-2">
				<span className="text-sm font-semibold text-rich-brown">Notifications</span>
			</div>
			<div className={dropdownMenuStyles.divider} />
			{items === null ? (
				<p className="px-4 py-6 text-sm text-ash-green text-center">Loading…</p>
			) : items.length === 0 ? (
				<p className="px-4 py-6 text-sm text-ash-green text-center">You’re all caught up</p>
			) : (
				<div className="max-h-[60vh] overflow-y-auto">
					{items.map((n) => (
						<NotificationRow key={n.id} n={n} onNavigate={() => setIsOpen(false)} />
					))}
				</div>
			)}
		</DropdownMenu>
	);
}
