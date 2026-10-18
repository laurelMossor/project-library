"use client";

import { useState } from "react";
import { PlusSignIcon } from "@/lib/components/icons/icons";
import { NewItemModal, type NewItemTarget } from "@/lib/components/nav-bar/NewItemModal";
import { TransparentCTAButton } from "./CreationCTA";

/** "+ Create" on a profile's collection: opens the New Post / New Event modal aimed at that profile. */
export function CollectionCreateButton({ target }: { target: NewItemTarget }) {
	const [open, setOpen] = useState(false);
	return (
		<>
			<TransparentCTAButton label="Create" icon={<PlusSignIcon className="w-4 h-4" />} onClick={() => setOpen(true)} className="pr-4" />
			{open && <NewItemModal target={target} onClose={() => setOpen(false)} />}
		</>
	);
}
