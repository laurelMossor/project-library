"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
	initial: { label?: string | null; value: string; url?: string | null };
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
};

export function LinkEditor({ initial, onFieldChange }: Props) {
	const [url, setUrl] = useState(initial.url ?? initial.value ?? "");
	const [label, setLabel] = useState(initial.label ?? "");
	const urlRef = useRef<HTMLInputElement>(null);

	useEffect(() => { urlRef.current?.focus(); }, []);

	return (
		<div className="flex flex-col gap-1">
			<input
				ref={urlRef}
				type="url"
				value={url}
				onChange={(e) => {
					setUrl(e.target.value);
					onFieldChange("url", e.target.value, initial.url ?? initial.value ?? "");
					onFieldChange("value", e.target.value, initial.value);
				}}
				placeholder="https://..."
				className="text-sm font-medium text-moss-green bg-transparent border-b border-transparent focus:border-moss-green focus:outline-none py-0.5 w-full"
			/>
			<input
				type="text"
				value={label}
				onChange={(e) => {
					setLabel(e.target.value);
					onFieldChange("label", e.target.value || null, initial.label ?? null);
				}}
				placeholder="Display label (optional)"
				className="text-xs text-dusty-grey bg-transparent border-b border-transparent focus:border-moss-green focus:outline-none py-0.5 w-full"
			/>
		</div>
	);
}
