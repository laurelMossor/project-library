"use client";

import { useState } from "react";
import type { ElementDraft } from "@/lib/types/inline-edit";
import type { ProfileElementKind } from "@/lib/types/profile-element";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";

const KINDS: { kind: ProfileElementKind; label: string; description: string }[] = [
	{ kind: "LINK", label: "Link", description: "Link to a website or social profile" },
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

	return (
		<DropdownMenu
			isOpen={open}
			onClose={() => setOpen((v) => !v)}
			triggerClassName="w-full text-sm text-dusty-grey hover:text-moss-green border border-dashed border-soft-grey/60 rounded-lg px-3 py-2 transition-colors text-left cursor-pointer"
			triggerAriaLabel="Add element"
			trigger={<span>+ New element</span>}
			containerClassName="min-w-[220px]"
		>
			{KINDS.map(({ kind, label, description }) => (
				<button
					key={kind}
					type="button"
					role="menuitem"
					onClick={() => handleSelect(kind)}
					className="w-full text-left px-4 py-2 hover:bg-melon-green/10 transition-colors"
				>
					<p className="text-sm font-medium">{label}</p>
					<p className="text-xs text-dusty-grey">{description}</p>
				</button>
			))}
		</DropdownMenu>
	);
}
