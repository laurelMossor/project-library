"use client";

import { useEffect, useState } from "react";
import { API_HANDLE_AVAILABLE } from "@/lib/const/routes";
import { sanitizeHandleTyping } from "@/lib/utils/handle";
import { validateHandle } from "@/lib/validations";
import { FieldLabel } from "@/lib/components/profile/FieldLabel";

type Status = { state: "idle" } | { state: "checking" } | { state: "ok" } | { state: "bad"; reason: string };

/**
 * A handle field for forms where nothing exists yet (signup, new page). It checks the handle
 * against the server as you type, so the person finds out before submitting. The check is a
 * convenience; the create call re-checks and is the real gate.
 */
export function HandleInput({
	value,
	onChange,
	onAvailable,
	highlight = false,
	autoFocus = false,
	currentHandle,
	variant = "inline",
}: {
	value: string;
	onChange: (handle: string) => void;
	/** True only when the current value is a free, valid handle. */
	onAvailable: (available: boolean) => void;
	highlight?: boolean;
	autoFocus?: boolean;
	/** The handle this person already owns. Keeping it is always fine, with no check. */
	currentHandle?: string;
	/**
	 * "inline": an underline, for the outlined identity block on setup and new page.
	 * "boxed": a bordered, required field that matches FormInput, for plain forms like signup.
	 */
	variant?: "inline" | "boxed";
}) {
	const [status, setStatus] = useState<Status>({ state: "idle" });
	const handle = sanitizeHandleTyping(value);

	useEffect(() => {
		if (!handle) {
			setStatus({ state: "idle" });
			onAvailable(false);
			return;
		}
		if (currentHandle && handle === currentHandle) {
			setStatus({ state: "idle" });
			onAvailable(true);
			return;
		}
		if (!validateHandle(handle)) {
			setStatus({ state: "bad", reason: "3–30 characters: lowercase letters, numbers, periods, underscores, hyphens." });
			onAvailable(false);
			return;
		}
		setStatus({ state: "checking" });
		onAvailable(false);
		let stale = false;
		const timer = setTimeout(async () => {
			try {
				const res = await fetch(`${API_HANDLE_AVAILABLE}?handle=${encodeURIComponent(handle)}`);
				const body = await res.json().catch(() => ({}));
				if (stale) return;
				if (res.ok && body.available) {
					setStatus({ state: "ok" });
					onAvailable(true);
				} else {
					setStatus({ state: "bad", reason: body.reason || body.error || "Couldn't check that handle." });
				}
			} catch {
				if (!stale) setStatus({ state: "bad", reason: "Couldn't check that handle." });
			}
		}, 400);
		return () => {
			stale = true;
			clearTimeout(timer);
		};
		// onAvailable is a state setter in every caller; re-running on its identity would loop.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [handle]);

	const boxed = variant === "boxed";

	return (
		<div className={highlight ? "rounded-md ring-2 ring-rich-brown p-3" : undefined}>
			{boxed ? (
				<FieldLabel label="Handle" htmlFor="handle-input" required />
			) : (
				<label htmlFor="handle-input" className="block text-sm font-medium">Handle</label>
			)}
			<div className={boxed
				? "mt-1 flex items-center gap-1 w-full border rounded p-2 focus-within:border-rich-brown"
				: "mt-1 flex items-center gap-1"}
			>
				<span className="text-base text-dusty-grey">@</span>
				<input
					id="handle-input"
					type="text"
					value={handle}
					onChange={(e) => onChange(sanitizeHandleTyping(e.target.value))}
					maxLength={30}
					autoFocus={autoFocus}
					autoCapitalize="none"
					autoCorrect="off"
					spellCheck={false}
					className={boxed
						? "flex-1 min-w-0 text-base focus:outline-none bg-transparent"
						: "flex-1 text-base border-b border-gray-300 py-1 focus:outline-none focus:border-rich-brown bg-transparent"}
				/>
			</div>
			<p className="text-xs text-dusty-grey mt-1">Your URL: /{handle || "handle"}</p>
			<p className="text-xs mt-1 min-h-4" aria-live="polite">
				{status.state === "checking" && <span className="text-dusty-grey">Checking…</span>}
				{status.state === "ok" && <span className="text-moss-green">✓ Available</span>}
				{status.state === "bad" && <span className="text-novel-red">{status.reason}</span>}
			</p>
		</div>
	);
}
