"use client";

import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "dark" | "outline";

// Full-width action buttons shared by the modal button panels.
const VARIANT_CLASS: Record<Variant, string> = {
	primary: "bg-melon-green text-rich-brown font-semibold hover:shadow-glow-sm transition-shadow",
	dark: "bg-rich-brown text-white font-semibold hover:opacity-90 transition-opacity",
	outline: "border border-dusty-grey text-warm-grey hover:text-rich-brown transition-colors",
};

type ModalButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant };

export function ModalButton({ variant = "primary", className = "", type = "button", ...props }: ModalButtonProps) {
	return (
		<button
			type={type}
			className={`w-full py-2 px-4 rounded disabled:opacity-50 ${VARIANT_CLASS[variant]} ${className}`}
			{...props}
		/>
	);
}
