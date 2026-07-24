"use client";

import type { InputHTMLAttributes } from "react";

// Shared caption text field for the image editor modals.
export function CaptionInput({ className = "", ...props }: InputHTMLAttributes<HTMLInputElement>) {
	return (
		<input
			type="text"
			placeholder="Add a caption…"
			maxLength={500}
			className={`w-full text-sm border border-ash-green rounded px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown ${className}`}
			{...props}
		/>
	);
}
