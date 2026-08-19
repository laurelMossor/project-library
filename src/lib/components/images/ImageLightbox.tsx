"use client";

import { useEffect } from "react";
import { useInlineEditSessionContext } from "@/lib/components/inline-editable/InlineEditSession";

type ImageLightboxProps = {
	src: string;
	alt: string;
	onClose: () => void;
};

/**
 * Full-size image viewer. Click the backdrop, press Escape, or use the close
 * button to dismiss. Hides the inline-edit save bar while open, same as ModalShell.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
	const setOverlayOpen = useInlineEditSessionContext()?.setOverlayOpen;
	useEffect(() => {
		setOverlayOpen?.(true);
		return () => setOverlayOpen?.(false);
	}, [setOverlayOpen]);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose]);

	return (
		<div
			className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
			onClick={onClose}
			role="dialog"
			aria-modal="true"
			aria-label={alt}
		>
			<button
				type="button"
				onClick={onClose}
				className="absolute top-4 right-4 text-white/80 hover:text-white"
				aria-label="Close"
			>
				<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" className="w-7 h-7" fill="currentColor">
					<path d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.5 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z" />
				</svg>
			</button>
			<img
				src={src}
				alt={alt}
				className="max-h-[90vh] max-w-[90vw] object-contain"
				onClick={(e) => e.stopPropagation()}
			/>
		</div>
	);
}
