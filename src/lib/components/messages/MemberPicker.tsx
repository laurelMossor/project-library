"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { ProfileSearchDropdown } from "@/lib/components/search/ProfileSearchDropdown";
import { API_MESSAGES_SUGGESTIONS } from "@/lib/const/routes";
import { searchResultEntity, type SearchResultItem } from "@/lib/types/search";
import { identityKey, type MessagingIdentityRef } from "@/lib/const/messaging";

type Props = {
	/** Acting identity (page id) — suggestions are the people/pages IT shares a follow with. */
	asPageId: string | null;
	selected: SearchResultItem[];
	onChange: (next: SearchResultItem[]) => void;
	/** Identities that can't be picked (the acting identity, existing participants). */
	excludeKeys: Set<string>;
	/** How many more can be picked before hitting the participant cap. */
	remaining: number;
};

export const toRef = (r: SearchResultItem): MessagingIdentityRef => ({ type: r.type, id: r.id });

/**
 * Pick people and pages for a group message: picked ones show as removable chips above the shared
 * profile picker, which suggests follow-connected people while the field is empty. Shared by the New
 * group message and Members (add) modals.
 */
export function MemberPicker({ asPageId, selected, onChange, excludeKeys, remaining }: Props) {
	const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);

	useEffect(() => {
		let cancelled = false;
		fetch(API_MESSAGES_SUGGESTIONS(asPageId))
			.then((r) => (r.ok ? r.json() : { results: [] }))
			.then((d) => { if (!cancelled) setSuggestions(d.results ?? []); })
			.catch(() => {});
		return () => { cancelled = true; };
	}, [asPageId]);

	// Already picked, or not pickable at all (you, existing participants).
	const unavailable = useMemo(
		() => new Set([...excludeKeys, ...selected.map(identityKey)]),
		[excludeKeys, selected],
	);
	const full = remaining <= 0;

	const add = (r: SearchResultItem) => { if (!full) onChange([...selected, r]); };
	const remove = (r: SearchResultItem) => onChange(selected.filter((s) => identityKey(s) !== identityKey(r)));

	return (
		<div className="flex flex-col gap-3">
			{selected.length > 0 && (
				<ul className="flex flex-wrap gap-1.5" aria-label="Selected members">
					{selected.map((r) => (
						<li key={identityKey(r)} className="flex items-center gap-1.5 rounded-full bg-melon-green text-rich-brown pl-1 pr-2 py-0.5 text-sm">
							<ProfilePicture entity={searchResultEntity(r)} size="sm" asLink={false} className="!w-6 !h-6 !text-[10px]" />
							<span className="max-w-[10rem] truncate">{r.name}</span>
							<button type="button" onClick={() => remove(r)} aria-label={`Remove ${r.name}`} className="opacity-60 hover:opacity-100">×</button>
						</li>
					))}
				</ul>
			)}

			<ProfileSearchDropdown
				type="all"
				placeholder="Search people and pages"
				onSelect={add}
				excludeKeys={unavailable}
				suggestions={suggestions}
				suggestionsLabel="People you're connected with"
				disabled={full}
				disabledHint="This group message is full."
				autoFocus={false}
			/>
		</div>
	);
}
