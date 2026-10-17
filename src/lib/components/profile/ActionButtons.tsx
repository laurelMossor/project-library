"use client";

import { useState } from "react";
import { useActionThunk, type ActionThunk } from "@/lib/hooks/useAction";

export type ActionDef = {
	label: string;
	/** A ready-to-call action; the buttons run it and report pending/refusal. */
	perform: ActionThunk;
	/** Visual emphasis — "danger" (default) hints red; "default" is the green primary. */
	tone?: "danger" | "default";
};

/** Shared pill-button look for row actions, so inline buttons elsewhere match these. */
export const rowActionClass = (tone: "danger" | "default" = "danger") =>
	`text-xs px-3 py-1 rounded-md font-medium transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20 ${
		tone === "danger"
			? "bg-white border border-red-300 text-red-600 hover:bg-red-50"
			: "bg-moss-green text-white hover:opacity-90"
	}`;

/**
 * A row of action buttons (Accept / Decline, Remove, Leave…). Each runs its action; only the pressed
 * one shows "…" while it saves.
 */
export function ActionButtons({
	actions,
	onRefused,
}: {
	actions: ActionDef[];
	/**
	 * Report a refusal here instead of beside the buttons. A row that unmounts when the page
	 * refreshes (a declined invite) would take an inline message with it.
	 */
	onRefused?: (message: string | null) => void;
}) {
	const { run, pending, error, clearError } = useActionThunk();
	const [pressed, setPressed] = useState<string | null>(null);

	function perform(action: ActionDef) {
		setPressed(action.label);
		clearError();
		onRefused?.(null);
		void run(action.perform).then((result) => {
			if (!result.ok && result.error !== "unauthorized") {
				onRefused?.(result.message ?? "Something went wrong. Please try again.");
			}
		});
	}

	return (
		<div className="flex items-center gap-1.5">
			{!onRefused && error && <p className="text-xs text-red-500 max-w-[160px] text-right leading-tight">{error}</p>}
			{actions.map((action) => (
				<button key={action.label} onClick={() => perform(action)} disabled={pending} className={rowActionClass(action.tone)}>
					{pending && pressed === action.label ? "..." : action.label}
				</button>
			))}
		</div>
	);
}
