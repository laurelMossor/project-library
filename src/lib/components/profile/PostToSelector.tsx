"use client";

import { useState } from "react";
import { Checkbox } from "@/lib/components/forms/Checkbox";
import { ProfileTag } from "./ProfileTag";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";
import { usePostToPages } from "@/lib/hooks/usePostToPages";

type Placement = { pageId: string | null; showOnAuthorProfile: boolean };

type Props = {
	/** The page this post currently lives on, or null for a personal post. */
	pageId: string | null;
	/** Your profile is included. A personal post (no page) treats this as checked. */
	showOnProfile: boolean;
	onChange: (next: Placement) => void;
};

/**
 * Where a post goes when you're speaking as yourself. "Your profile" starts checked.
 * At most one page. At least one box stays checked. Checking a second page replaces the first.
 */
export function PostToSelector({ pageId, showOnProfile, onChange }: Props) {
	const { currentUser } = useActiveProfile();
	const pages = usePostToPages();
	const [open, setOpen] = useState(false);
	const [note, setNote] = useState<string | null>(null);

	const profileOn = pageId === null || showOnProfile;
	const selectedPage = pages.find((p) => p.id === pageId) ?? null;

	const summaryParts = [
		profileOn ? "You" : null,
		selectedPage?.name ?? null,
	].filter(Boolean);
	const summary = summaryParts.length > 0 ? summaryParts.join(" · ") : "choose where";

	function emit(nextProfile: boolean, nextPageId: string | null) {
		if (!nextProfile && !nextPageId) return;
		if (!nextPageId) {
			onChange({ pageId: null, showOnAuthorProfile: false });
			return;
		}
		onChange({ pageId: nextPageId, showOnAuthorProfile: nextProfile });
	}

	function toggleProfile() {
		setNote(null);
		if (profileOn && !pageId) return;
		emit(!profileOn, pageId);
	}

	function togglePage(id: string) {
		setNote(null);
		if (pageId === id) {
			if (!profileOn) return;
			emit(true, null);
			return;
		}
		if (pageId && pageId !== id) setNote("One page per post for now");
		emit(profileOn, id);
	}

	return (
		<div>
			<label className="block text-sm font-medium mb-1">Post to</label>
			<p className="text-xs text-dusty-grey mb-1">
				Your profile is where it shows up. A page is a place it also lives. Pick at most one page.
			</p>
			<div className="relative">
				<button
					type="button"
					onClick={() => setOpen((o) => !o)}
					className="w-full text-left px-3 py-2 rounded-lg border border-soft-grey bg-white text-sm text-rich-brown"
					aria-expanded={open}
				>
					Posting to: {summary}
				</button>
				{open && (
					<>
						<div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
						<div className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-soft-grey rounded-lg shadow-lg p-3 space-y-3">
							{currentUser && (
								<div className="flex items-center gap-3">
									<Checkbox checked={profileOn} onChange={toggleProfile} label="Your profile" hideLabel />
									<ProfileTag entity={currentUser} size="sm" asLink={false} />
								</div>
							)}
							{pages.map((page) => (
								<div key={page.id} className="flex items-center gap-3">
									<Checkbox
										checked={pageId === page.id}
										onChange={() => togglePage(page.id)}
										label={page.name}
										hideLabel
									/>
									<ProfileTag entity={page} size="sm" asLink={false} />
								</div>
							))}
							{pages.length === 0 && (
								<p className="text-xs text-dusty-grey">No pages you can post to yet.</p>
							)}
							{note && <p className="text-xs text-dusty-grey">{note}</p>}
						</div>
					</>
				)}
			</div>
		</div>
	);
}
