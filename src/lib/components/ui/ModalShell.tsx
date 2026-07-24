"use client";

import { useEffect, type ReactNode } from "react";
import { useInlineEditSessionContext } from "@/lib/components/inline-editable/InlineEditSession";

type ModalShellProps = {
	title: string;
	onClose: () => void;
	/** Panel max-width (e.g. "max-w-sm", "max-w-lg"). Defaults to "max-w-sm". */
	widthClassName?: string;
	children: ReactNode;
};

/**
 * Centered modal shell: translucent backdrop, panel, and a title + close header.
 * While mounted it hides the page's InlineEditSession save/publish bar (null-safe —
 * a no-op outside an edit session) so the bar doesn't show through the backdrop.
 * Render it only when the modal is open (mount = open, unmount = closed).
 */
export function ModalShell({ title, onClose, widthClassName = "max-w-sm", children }: ModalShellProps) {
	const setOverlayOpen = useInlineEditSessionContext()?.setOverlayOpen;
	useEffect(() => {
		setOverlayOpen?.(true);
		return () => setOverlayOpen?.(false);
	}, [setOverlayOpen]);

	return (
		<div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60]" onClick={onClose}>
			<div className={`bg-grey-white rounded-lg p-6 w-full mx-4 ${widthClassName}`} onClick={(e) => e.stopPropagation()}>
				<div className="flex justify-between items-center mb-4">
					<h2 className="text-2xl font-bold">{title}</h2>
					<button onClick={onClose} className="text-warm-grey hover:text-rich-brown" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" className="w-6 h-6" fill="currentColor">
							<path d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.5 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z" />
						</svg>
					</button>
				</div>
				{children}
			</div>
		</div>
	);
}
