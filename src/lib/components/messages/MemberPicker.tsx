"use client";

import { useEffect, useMemo, useState } from "react";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { API_MESSAGES_SUGGESTIONS } from "@/lib/const/routes";
import { searchResultEntity, type SearchResultItem } from "@/lib/types/search";
import { identityKey, type MessagingIdentityRef } from "@/lib/const/messaging";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";

type Props = {
	/** Acting identity (page id) — suggestions are the people/pages IT shares a follow with. */
	asPageId: string | null;
	selected: SearchResultItem[];
	onChange: (next: SearchResultItem[]) => void;
	/** Identities that can't be picked (the acting identity, existing members). */
	excludeKeys: Set<string>;
	/** How many more can be picked before hitting the group cap. */
	remaining: number;
};

export const toRef = (r: SearchResultItem): MessagingIdentityRef => ({ type: r.type, id: r.id });

/**
 * Pick group members: follow-connected suggestions first, then search over everyone. Picked members
 * show as removable chips. Shared by the New Group and Members (add) modals.
 */
export function MemberPicker({ asPageId, selected, onChange, excludeKeys, remaining }: Props) {
	const [suggestions, setSuggestions] = useState<SearchResultItem[]>([]);
	const [query, setQuery] = useState("");
	const { results } = useProfileSearch(query, "all");
	const searching = query.trim().length >= MIN_SEARCH_LENGTH;

	useEffect(() => {
		let cancelled = false;
		fetch(API_MESSAGES_SUGGESTIONS(asPageId))
			.then((r) => (r.ok ? r.json() : { results: [] }))
			.then((d) => { if (!cancelled) setSuggestions(d.results ?? []); })
			.catch(() => {});
		return () => { cancelled = true; };
	}, [asPageId]);

	const selectedKeys = useMemo(() => new Set(selected.map(identityKey)), [selected]);
	const pickable = (r: SearchResultItem) => !excludeKeys.has(identityKey(r)) && !selectedKeys.has(identityKey(r));
	const list = (searching ? results : suggestions).filter(pickable);
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

			<input
				type="search"
				value={query}
				onChange={(e) => setQuery(e.target.value)}
				placeholder="Search people and pages"
				aria-label="Search people and pages"
				className="w-full rounded-lg border border-soft-grey bg-white/60 px-3 py-2 text-sm focus:outline-none focus:border-misty-forest"
			/>

			<div>
				<p className="text-[11px] uppercase tracking-wider text-dusty-grey mb-1">
					{searching ? "Results" : "People you're connected with"}
				</p>
				{full && <p className="text-xs text-novel-red mb-1">This group is full.</p>}
				{list.length === 0 ? (
					<p className="text-sm text-dusty-grey py-2">
						{searching ? "No matches." : "No suggestions yet — search above."}
					</p>
				) : (
					<ul className="max-h-56 overflow-y-auto -mx-1">
						{list.map((r) => (
							<li key={identityKey(r)}>
								<button
									type="button"
									onClick={() => add(r)}
									disabled={full}
									className="w-full flex items-center gap-3 rounded-lg px-1 py-1.5 text-left hover:bg-ash-green/40 disabled:opacity-50 disabled:cursor-not-allowed"
								>
									<ProfilePicture entity={searchResultEntity(r)} size="sm" asLink={false} />
									<span className="min-w-0">
										<span className="block text-sm text-rich-brown truncate">{r.name}</span>
										<span className="block text-xs text-dusty-grey truncate">@{r.handle}{r.type === "page" ? " · page" : ""}</span>
									</span>
								</button>
							</li>
						))}
					</ul>
				)}
			</div>
		</div>
	);
}
