"use client";

import { useEffect } from "react";

/**
 * Leaves /setup with a full page load.
 *
 * A finished account that reaches this page through client navigation still has the
 * root layout from before setup completed. That layout's SetupGate would send the
 * browser back to /setup, and a soft redirect() to Explore would replay the same
 * layout — the two bounce forever. A document load renders the layout again.
 */
export function LeaveSetup({ to }: { to: string }) {
	useEffect(() => {
		window.location.replace(to);
	}, [to]);

	return null;
}
