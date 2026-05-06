"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
	initial: { label?: string | null; value: string; url?: string | null };
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
	onCancel?: () => void;
};

export function SocialLinkEditor({ initial, onFieldChange, onCancel }: Props) {
	const [url, setUrl] = useState(initial.url ?? initial.value ?? "");
	const [label, setLabel] = useState(initial.label ?? "");
	const urlRef = useRef<HTMLInputElement>(null);

	useEffect(() => { urlRef.current?.focus(); }, []);

	const cls = "w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moss-green";

	return (
		<div className="flex flex-col gap-2">
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
				className={cls}
			/>
			<input
				type="text"
				value={label}
				onChange={(e) => {
					setLabel(e.target.value);
					onFieldChange("label", e.target.value || null, initial.label ?? null);
				}}
				placeholder="Display label (optional)"
				className={cls}
			/>
			{onCancel && (
				<button type="button" onClick={onCancel} className="self-start text-xs text-dusty-grey hover:text-rich-brown transition-colors">
					Discard
				</button>
			)}
		</div>
	);
}
