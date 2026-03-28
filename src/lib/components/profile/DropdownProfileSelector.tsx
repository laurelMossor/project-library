"use client";

import { useState, useEffect } from "react";
import { CardEntity } from "@/lib/types/card";
import { ProfileTag } from "./ProfileTag";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

export type DropdownProfileSelectorProps = {
	label?: string;
	onChange?: (pageId: string | null) => void;
	/** Seed the selection with a specific page id. Defaults to the active profile. */
	initialPageId?: string | null;
};

export function DropdownProfileSelector({ label, onChange, initialPageId }: DropdownProfileSelectorProps) {
	const { activeEntity, currentUser, pages, fetchPages, activePageId } = useActiveProfile();
	// Tracks an explicit user selection; undefined means "use initial/active profile"
	const [override, setOverride] = useState<{ pageId: string | null } | undefined>(undefined);
	const selectedPageId = override !== undefined ? override.pageId : (initialPageId !== undefined ? initialPageId : activePageId);
	const [open, setOpen] = useState(false);

	// Pre-load pages on mount so the dropdown is ready and the active role badge is available
	// eslint-disable-next-line react-hooks/exhaustive-deps
	useEffect(() => { fetchPages(); }, []);

	// Prefer already-resolved activeEntity when showing the active page, otherwise look up in pages
	const selectedEntity: CardEntity | null =
		selectedPageId === null
			? currentUser
			: selectedPageId === activePageId
				? activeEntity
				: pages.find((p) => p.id === selectedPageId) ?? null;

	function handleOpen() {
		setOpen((o) => !o);
	}

	function select(pageId: string | null) {
		setOverride({ pageId });
		onChange?.(pageId);
		setOpen(false);
	}

	return (
		<div>
			{label && <label className="block text-sm font-medium mb-1">{label}</label>}
			<div className="relative">
				<button
					type="button"
					onClick={handleOpen}
					className="w-full text-left"
					aria-expanded={open}
					aria-haspopup="listbox"
				>
					{selectedEntity ? (
						<ProfileTag entity={selectedEntity} size="sm" asLink={false} />
					) : (
						<span className="text-sm text-dusty-grey">Loading...</span>
					)}
				</button>

				{open && (
					<>
						<div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
						<div role="listbox" className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-soft-grey rounded-lg shadow-lg py-1">
							{currentUser && (
								<Option selected={selectedPageId === null} onClick={() => select(null)}>
									<ProfileTag entity={currentUser} size="sm" asLink={false} />
								</Option>
							)}
							{pages.map((page) => (
								<Option key={page.id} selected={selectedPageId === page.id} onClick={() => select(page.id)}>
									<ProfileTag entity={page} size="sm" asLink={false} badge={page.role.toLowerCase()} />
								</Option>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
}

type OptionProps = {
	selected: boolean;
	onClick: () => void;
	children: React.ReactNode;
};

function Option({ selected, onClick, children }: OptionProps) {
	return (
		<div
			role="option"
			aria-selected={selected}
			onClick={onClick}
			className={`px-3 py-1 cursor-pointer transition-opacity ${selected ? "bg-soft-grey/20" : "hover:opacity-80"}`}
		>
			{children}
		</div>
	);
}
