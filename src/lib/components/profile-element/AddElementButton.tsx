"use client";

import { useState } from "react";
import type { ElementDraft } from "@/lib/types/inline-edit";
import type { ProfileElementKind } from "@/lib/types/profile-element";

const KINDS: { kind: ProfileElementKind; label: string; description: string }[] = [
	{ kind: "SOCIAL_LINK", label: "Social link", description: "Link to a social profile or website" },
	{ kind: "CTA", label: "Call to action", description: "Highlight an offer, project, or link" },
	{ kind: "TEXT", label: "Text", description: "A labeled paragraph or note" },
];

type Props = {
	onAdd: (draft: ElementDraft) => void;
	nextSortOrder: number;
};

export function AddElementButton({ onAdd, nextSortOrder }: Props) {
	const [open, setOpen] = useState(false);

	const handleSelect = (kind: ProfileElementKind) => {
		const draft: ElementDraft = {
			tempId: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
			kind,
			value: "",
			sortOrder: nextSortOrder,
		};
		onAdd(draft);
		setOpen(false);
	};

	if (open) {
		return (
			<div className="border rounded-lg p-3 bg-white space-y-1">
				<p className="text-xs font-medium text-dusty-grey uppercase tracking-wider mb-2">
					Add element
				</p>
				{KINDS.map(({ kind, label, description }) => (
					<button
						key={kind}
						type="button"
						onClick={() => handleSelect(kind)}
						className="w-full text-left px-3 py-2 rounded-md hover:bg-melon-green/10 transition-colors"
					>
						<p className="text-sm font-medium">{label}</p>
						<p className="text-xs text-dusty-grey">{description}</p>
					</button>
				))}
				<button
					type="button"
					onClick={() => setOpen(false)}
					className="text-xs text-dusty-grey hover:text-rich-brown transition-colors mt-1 px-3"
				>
					Cancel
				</button>
			</div>
		);
	}

	return (
		<button
			type="button"
			onClick={() => setOpen(true)}
			className="w-full text-sm text-dusty-grey hover:text-moss-green border border-dashed border-soft-grey/60 rounded-lg px-3 py-2 transition-colors text-left"
		>
			+ Add element
		</button>
	);
}
