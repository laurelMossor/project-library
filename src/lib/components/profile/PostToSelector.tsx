"use client";

import { useEffect, useId, useState } from "react";
import { Checkbox } from "@/lib/components/forms/Checkbox";
import { ProfileTag } from "./ProfileTag";
import { DropdownShell } from "./DropdownShell";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { usePostToPages } from "@/lib/hooks/usePostToPages";

type Placement = { pageId: string | null; showOnAuthorProfile: boolean };

type Props = {
	/** The page this post currently lives on, or null for a personal post. */
	pageId: string | null;
	/** Your profile is included. A personal post (no page) treats this as selected. */
	showOnProfile: boolean;
	onChange: (next: Placement) => void;
};

type Selection = { profile: boolean; pageId: string | null };

/**
 * Where a post goes when you're speaking as yourself. Your profile is a checkbox.
 * The pages you can post to are radios, one page at a time, and a chosen page
 * can be cleared. The menu asks for at least one until you pick again.
 */
export function PostToSelector({ pageId, showOnProfile, onChange }: Props) {
	const { currentUser } = useActiveProfile();
	const pages = usePostToPages();
	const groupId = useId();
	const [open, setOpen] = useState(false);
	// Holds a selection that isn't saved yet, including "nothing selected".
	const [draft, setDraft] = useState<Selection | null>(null);

	const committed: Selection = {
		profile: pageId === null || showOnProfile,
		pageId,
	};
	const selection = draft ?? committed;
	const optionCount = (currentUser ? 1 : 0) + pages.length;
	const empty = !selection.profile && !selection.pageId;

	useEffect(() => {
		setDraft(null);
	}, [pageId, showOnProfile]);

	function apply(next: Selection) {
		setDraft(next);
		if (!next.profile && !next.pageId) return;
		if (!next.pageId) {
			onChange({ pageId: null, showOnAuthorProfile: false });
			return;
		}
		onChange({ pageId: next.pageId, showOnAuthorProfile: next.profile });
	}

	function setOpenAndMaybeRevert(nextOpen: boolean) {
		setOpen(nextOpen);
		// Closing without a selection returns to the last saved placement.
		if (!nextOpen) setDraft(null);
	}

	if (pages.length === 0) return null;

	return (
		<DropdownShell
			label="Post to a page?"
			hint="Decide where your post shows up"
			optionCount={optionCount}
			open={open}
			onOpenChange={setOpenAndMaybeRevert}
		>
			{empty && (
				<p className="px-3 pt-2 text-xs text-alert-red">you must select at least one profile</p>
			)}
			{currentUser && (
				<OptionRow>
					<Checkbox
						checked={selection.profile}
						onChange={(profile) => apply({ profile, pageId: selection.pageId })}
						label="Your profile"
						hideLabel
					/>
					<ProfileTag entity={currentUser} size="sm" asLink={false} className="w-full flex-1 min-w-0" />
				</OptionRow>
			)}
			<Divider />
			{pages.map((page) => (
				<OptionRow key={page.id}>
					<PageRadio
						name={`${groupId}-page`}
						checked={selection.pageId === page.id}
						label={page.name}
						onSelect={() => apply({ profile: false, pageId: page.id })}
						onClear={() => apply({ profile: selection.profile, pageId: null })}
					/>
					<ProfileTag entity={page} size="sm" asLink={false} className="w-full flex-1 min-w-0" />
				</OptionRow>
			))}
		</DropdownShell>
	);
}

/**
 * One page at a time. Clicking the selected page again clears it.
 * The key remounts the input when it clears, so the circle doesn't stay filled.
 */
function PageRadio({ name, checked, label, onSelect, onClear }: { name: string; checked: boolean; label: string; onSelect: () => void; onClear: () => void }) {
	return (
		<input
			key={checked ? "on" : "off"}
			type="radio"
			name={name}
			checked={checked}
			aria-label={label}
			onChange={() => {
				if (!checked) onSelect();
			}}
			onClick={() => {
				if (checked) onClear();
			}}
			className="accent-moss-green"
		/>
	);
}

function OptionRow({ children }: { children: React.ReactNode }) {
	return <div className="flex items-center gap-3 px-2 py-1 [&>:last-child]:min-w-0 [&>:last-child]:flex-1">{children}</div>;
}

function Divider() {
	return <div className="my-1 mx-2 border-t border-soft-grey" role="separator" />;
}
