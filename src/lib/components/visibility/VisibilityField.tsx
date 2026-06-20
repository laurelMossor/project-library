"use client";

import { VisibilitySelector } from "./VisibilitySelector";
import { useInlineField } from "@/lib/hooks/useInlineField";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { Visibility } from "@/lib/types/user";

type Props = {
	/** Section label, e.g. "Profile Visibility" or "Page Visibility". */
	label: string;
	/** Committed value from the loaded resource (user or page). */
	initial: Visibility;
};

/**
 * Visibility radio group wired into the surrounding InlineEditSession: the change
 * batches with every other field and saves via the shared Save bar (no standalone
 * auto-save). Shared by user and page profiles so the two stay in lockstep.
 */
export function VisibilityField({ label, initial }: Props) {
	const session = useInlineEditSession();
	const { value, setValue } = useInlineField<Visibility>("visibility", initial);
	const canEdit = session?.canEdit ?? false;

	return (
		<div className="border-t border-gray-100 pt-4">
			<p className="text-xs text-dusty-grey mb-3 uppercase tracking-wide">{label}</p>
			<VisibilitySelector value={value} onChange={setValue} disabled={!canEdit} />
		</div>
	);
}
