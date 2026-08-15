"use client";

import { useEffect, useState } from "react";
import { formatInstantAbsolute, formatRelativeTime } from "@/lib/utils/datetime";

type LocalDateProps = {
	value: Date | string;
	mode: "absolute" | "relative";
	prefix?: string;
	className?: string;
};

function toIso(value: Date | string): string {
	const d = typeof value === "string" ? new Date(value) : value;
	return d.toISOString();
}

/**
 * Renders an instant timestamp in the viewer's local timezone after mount only,
 * so SSR and the first client pass agree (empty) and hydration stays clean.
 */
export function LocalDate({ value, mode, prefix = "", className }: LocalDateProps) {
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const label = mounted
		? prefix + (mode === "absolute" ? formatInstantAbsolute(value) : formatRelativeTime(value))
		: "";

	return (
		<time dateTime={toIso(value)} className={className} suppressHydrationWarning>
			{label || "\u00a0"}
		</time>
	);
}
