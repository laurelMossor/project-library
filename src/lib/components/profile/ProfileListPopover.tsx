"use client";

import { useState } from "react";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { ProfileTag } from "./ProfileTag";
import { useAction } from "@/lib/hooks/useAction";
import { listProfileConnectionsAction } from "@/lib/actions/profile-lists";
import type { CardEntity } from "@/lib/types/card";
import type { ProfileList } from "@/lib/types/profile";

type ProfileListPopoverProps = {
	target: { type: "user" | "page"; id: string };
	list: ProfileList;
	/** The trigger: usually a count and its label. */
	children: React.ReactNode;
	emptyMessage: string;
};

/**
 * A popover listing the people behind a count (Followers / Following / Members). The list loads
 * when it opens; the server decides whether this viewer may see it, so a refusal shows its message
 * instead of a list.
 */
export function ProfileListPopover({ target, list, children, emptyMessage }: ProfileListPopoverProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [items, setItems] = useState<CardEntity[] | null>(null);
	const [error, setError] = useState<string | null>(null);
	const { run } = useAction(listProfileConnectionsAction);

	const toggle = () => {
		if (!isOpen) {
			setItems(null);
			setError(null);
			void run({ target, list }).then((result) => {
				if (result.ok) setItems(result.data);
				else setError(result.message ?? "Couldn't load this list.");
			});
		}
		setIsOpen((open) => !open);
	};

	return (
		<DropdownMenu
			isOpen={isOpen}
			onClose={toggle}
			align="left"
			triggerAriaLabel={`Show ${list}`}
			triggerClassName="text-sm text-gray-700 hover:text-rich-brown cursor-pointer rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20"
			containerClassName="w-[min(320px,calc(100vw-2rem))] max-h-[360px] overflow-y-auto"
			trigger={children}
		>
			{error ? (
				<p role="alert" className="px-4 py-3 text-xs text-red-500">{error}</p>
			) : items === null ? (
				<p className="px-4 py-3 text-xs text-dusty-grey">Loading…</p>
			) : items.length === 0 ? (
				<p className="px-4 py-3 text-xs text-dusty-grey">{emptyMessage}</p>
			) : (
				// Picking a row navigates to that profile; close the popover with it.
				<div className="px-2 space-y-1" onClick={() => setIsOpen(false)}>
					{items.map((entity) => (
						<ProfileTag key={entity.id} entity={entity} size="sm" className="w-full" />
					))}
				</div>
			)}
		</DropdownMenu>
	);
}
