"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
	initial: { label?: string | null; value: string; caption?: string | null };
	onFieldChange: (field: string, value: unknown, original?: unknown) => void;
};

export function TextEditor({ initial, onFieldChange }: Props) {
	const [label, setLabel] = useState(initial.label ?? "");
	const [value, setValue] = useState(initial.value ?? "");
	const [caption, setCaption] = useState(initial.caption ?? "");
	const firstRef = useRef<HTMLInputElement>(null);

	useEffect(() => { firstRef.current?.focus(); }, []);

	return (
		<div className="flex flex-col gap-0.5">
			<input
				ref={firstRef}
				type="text"
				value={label}
				onChange={(e) => { setLabel(e.target.value); onFieldChange("label", e.target.value || null, initial.label ?? null); }}
				placeholder="Label (optional)"
				className="text-xs font-medium text-dusty-grey uppercase tracking-wider bg-transparent border-b border-transparent focus:border-moss-green focus:outline-none py-0.5 w-full"
			/>
			<textarea
				value={value}
				onChange={(e) => { setValue(e.target.value); onFieldChange("value", e.target.value, initial.value); }}
				placeholder="Content"
				rows={2}
				className="text-sm bg-transparent border-b border-transparent focus:border-moss-green focus:outline-none py-0.5 w-full resize-none whitespace-pre-wrap"
			/>
			<input
				type="text"
				value={caption}
				onChange={(e) => { setCaption(e.target.value); onFieldChange("caption", e.target.value || null, initial.caption ?? null); }}
				placeholder="Caption (optional)"
				className="text-xs text-dusty-grey bg-transparent border-b border-transparent focus:border-moss-green focus:outline-none py-0.5 w-full"
			/>
		</div>
	);
}
