import { useCallback, useEffect, useRef } from "react";

/**
 * Runs `discard` once when this screen is left, unless `keep()` was called first.
 *
 * Armed on a timeout so React Strict Mode's immediate remount does not discard,
 * the same guard empty post and event drafts use. `pagehide` covers closing the
 * tab and other full document navigations; the discard request itself should
 * set `keepalive` so the browser can finish it as the page goes away.
 *
 * Returns whether a discard actually started. `false` means the row was kept.
 */
export function useDiscardOnLeave(discard: () => void | Promise<unknown>) {
	const discardRef = useRef(discard);
	discardRef.current = discard;
	const keepRef = useRef(false);
	const discardedRef = useRef(false);
	const inFlight = useRef<Promise<boolean> | null>(null);

	const run = useCallback(() => {
		if (keepRef.current) return Promise.resolve(false);
		if (inFlight.current) return inFlight.current;
		discardedRef.current = true;
		const pending = Promise.resolve()
			.then(() => discardRef.current())
			.then(() => true)
			.catch((error) => {
				inFlight.current = null;
				throw error;
			});
		inFlight.current = pending;
		return pending;
	}, []);

	useEffect(() => {
		let armed = false;
		const armTimer = setTimeout(() => {
			armed = true;
		}, 0);
		const onHide = () => {
			if (armed) void run().catch(() => {});
		};
		window.addEventListener("pagehide", onHide);
		return () => {
			clearTimeout(armTimer);
			window.removeEventListener("pagehide", onHide);
			if (armed) void run().catch(() => {});
		};
	}, [run]);

	const keep = useCallback(() => {
		keepRef.current = true;
	}, []);
	const wasDiscarded = useCallback(() => discardedRef.current, []);

	return { keep, discard: run, wasDiscarded };
}
