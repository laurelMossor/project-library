"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { useInlineEditSessionContext } from "@/lib/components/inline-editable/InlineEditSession";
import { XIcon } from "@/lib/components/icons/icons";

type ModalShellProps = {
	/** Panel heading. Omitted for `variant="media"`, which uses `ariaLabel` instead. */
	title?: string;
	onClose: () => void;
	/** Panel max-width (e.g. "max-w-sm", "max-w-lg"). Defaults to "max-w-sm". Ignored for media. */
	widthClassName?: string;
	children?: ReactNode;
	/**
	 * When false, Escape, backdrop click, and the close button do nothing.
	 * Busy confirms and in-flight uploads use this so a dismiss can't race the request.
	 */
	dismissible?: boolean;
	/** `panel` is the centered card. `media` is the lightbox: dimmer backdrop, no card. */
	variant?: "panel" | "media";
	/** Accessible name for `variant="media"` (there is no visible title). */
	ariaLabel?: string;
};

/**
 * The one modal origin. Backdrop, dialog semantics, Escape, and focus live here so every
 * modal dims the same way and returns focus to whatever opened it.
 * Render it only when the modal is open (mount = open, unmount = closed).
 * While mounted it hides the page's InlineEditSession save bar (a no-op outside a session).
 */
export function ModalShell({
	title,
	onClose,
	widthClassName = "max-w-sm",
	children,
	dismissible = true,
	variant = "panel",
	ariaLabel,
}: ModalShellProps) {
	const setOverlayOpen = useInlineEditSessionContext()?.setOverlayOpen;
	const dialogRef = useRef<HTMLDivElement>(null);
	const closeRef = useRef<HTMLButtonElement>(null);
	// Captured during render, before commit moves focus into an autoFocus field.
	const triggerRef = useRef<HTMLElement | null>(null);
	if (triggerRef.current === null && typeof document !== "undefined") {
		const active = document.activeElement;
		triggerRef.current = active instanceof HTMLElement ? active : null;
	}

	useEffect(() => {
		setOverlayOpen?.(true);
		return () => setOverlayOpen?.(false);
	}, [setOverlayOpen]);

	useEffect(() => {
		const root = dialogRef.current;
		const active = document.activeElement;
		const focusedInside = !!root && active instanceof Node && root.contains(active) && active !== root;
		if (!focusedInside) closeRef.current?.focus();
		return () => {
			triggerRef.current?.focus();
		};
	}, []);

	useEffect(() => {
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") {
				if (dismissible) onClose();
				return;
			}
			// The lightbox's only control is Close, so Tab stays there. Panel modals keep normal tab order.
			if (variant === "media" && e.key === "Tab") {
				e.preventDefault();
				closeRef.current?.focus();
			}
		};
		document.addEventListener("keydown", onKey);
		return () => document.removeEventListener("keydown", onKey);
	}, [onClose, dismissible, variant]);

	function requestClose() {
		if (dismissible) onClose();
	}

	const closeButton = (
		<button
			ref={closeRef}
			type="button"
			onClick={requestClose}
			disabled={!dismissible}
			className={
				variant === "media"
					? "absolute top-4 right-4 text-white/80 hover:text-white disabled:opacity-40"
					: "text-warm-grey hover:text-rich-brown disabled:opacity-40"
			}
			aria-label="Close"
		>
			<XIcon className={variant === "media" ? "w-7 h-7" : "w-6 h-6"} />
		</button>
	);

	if (variant === "media") {
		return (
			<div
				ref={dialogRef}
				className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
				onClick={requestClose}
				role="dialog"
				aria-modal="true"
				aria-label={ariaLabel}
			>
				{closeButton}
				{children}
			</div>
		);
	}

	return (
		<div
			ref={dialogRef}
			className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]"
			onClick={requestClose}
			role="dialog"
			aria-modal="true"
			aria-labelledby="modal-title"
		>
			<div className={`bg-grey-white rounded-lg p-6 w-full mx-4 ${widthClassName}`} onClick={(e) => e.stopPropagation()}>
				<div className="flex justify-between items-center mb-4">
					<h2 id="modal-title" className="text-2xl font-bold">{title}</h2>
					{closeButton}
				</div>
				{children}
			</div>
		</div>
	);
}
