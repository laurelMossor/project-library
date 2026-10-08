"use client";

import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { isCardPage, resolveCardIdentity, type CardEntity } from "@/lib/types/card";

type ProfileResultListProps<T extends CardEntity> = {
	results: T[];
	/** Keyboard-highlighted row, or -1. */
	focusedIndex: number;
	onFocusIndex: (index: number) => void;
	onSelect: (entity: T) => void;
};

/**
 * The rows of a profile search popover: avatar, name, @handle (with "· page" for pages). Presentational
 * only — the owner holds the query, open state, and keyboard handling. Rows keep focus in the field on
 * mousedown so picking one doesn't blur the input first. Shared by ProfileSearchDropdown and the
 * comment box's @-mention popover.
 */
export function ProfileResultList<T extends CardEntity>({ results, focusedIndex, onFocusIndex, onSelect }: ProfileResultListProps<T>) {
	return (
		<ul role="listbox" className="py-1">
			{results.map((entity, index) => {
				const { name, handle } = resolveCardIdentity(entity);
				return (
					<li
						key={`${isCardPage(entity) ? "page" : "user"}:${entity.id}`}
						role="option"
						aria-selected={focusedIndex === index}
						onMouseDown={(e) => e.preventDefault()}
						onClick={() => onSelect(entity)}
						onMouseEnter={() => onFocusIndex(index)}
						className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
							focusedIndex === index ? "bg-grey-white" : "hover:bg-grey-white/60"
						}`}
					>
						<ProfilePicture entity={entity} size="sm" asLink={false} />
						<div className="min-w-0">
							<p className="text-sm font-medium text-rich-brown leading-tight truncate">{name}</p>
							<p className="text-xs text-dusty-grey truncate">
								@{handle}{isCardPage(entity) ? " · page" : ""}
							</p>
						</div>
					</li>
				);
			})}
		</ul>
	);
}
