"use client";

import { ModalShell } from "@/lib/components/ui/ModalShell";

type ImageLightboxProps = {
	src: string;
	alt: string;
	onClose: () => void;
};

/**
 * Full-size image viewer. Click the backdrop, press Escape, or use the close
 * button to dismiss. The shell owns focus and the dimmed backdrop.
 */
export function ImageLightbox({ src, alt, onClose }: ImageLightboxProps) {
	return (
		<ModalShell variant="media" ariaLabel={alt} onClose={onClose}>
			<img
				src={src}
				alt={alt}
				className="max-h-[90vh] max-w-[90vw] object-contain"
				onClick={(e) => e.stopPropagation()}
			/>
		</ModalShell>
	);
}
