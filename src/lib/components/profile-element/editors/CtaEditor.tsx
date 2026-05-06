"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
	initial: { label?: string | null; value: string; caption?: string | null; url?: string | null };
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
	onCancel?: () => void;
};

export function CtaEditor({ initial, onFieldChange, onCancel }: Props) {
	const [label, setLabel] = useState(initial.label ?? "");
	const [value, setValue] = useState(initial.value ?? "");
	const [caption, setCaption] = useState(initial.caption ?? "");
	const [url, setUrl] = useState(initial.url ?? "");
	const firstRef = useRef<HTMLInputElement>(null);

	useEffect(() => { firstRef.current?.focus(); }, []);

	const cls = "w-full text-sm border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-moss-green";

	return (
		<div className="flex flex-col gap-2">
			<input
				ref={firstRef}
				type="text"
				value={label}
				onChange={(e) => { setLabel(e.target.value); onFieldChange("label", e.target.value || null, initial.label ?? null); }}
				placeholder="Label (optional)"
				className={cls}
			/>
			<input
				type="text"
				value={value}
				onChange={(e) => { setValue(e.target.value); onFieldChange("value", e.target.value, initial.value); }}
				placeholder="Headline (required)"
				className={cls}
			/>
			<textarea
				value={caption}
				onChange={(e) => { setCaption(e.target.value); onFieldChange("caption", e.target.value || null, initial.caption ?? null); }}
				placeholder="Caption (optional)"
				rows={2}
				className={`${cls} resize-none`}
			/>
			<input
				type="url"
				value={url}
				onChange={(e) => { setUrl(e.target.value); onFieldChange("url", e.target.value || null, initial.url ?? null); }}
				placeholder="Button URL (optional)"
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
