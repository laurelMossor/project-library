"use client";

import { useRef, useLayoutEffect, useEffect, useId, useState, ReactNode, RefObject } from "react";

const DROPDOWN_OPEN = "prolib:dropdown-open";

/**
 * One menu at a time. Opening this one asks every other open menu to close, and a press
 * outside this menu closes it. A press on another menu's trigger is left to that menu,
 * so the two don't both try to dismiss and the other one can open.
 */
export function useOneOpenMenu(
	isOpen: boolean,
	dismiss: () => void,
	rootRef: RefObject<HTMLElement | null>,
) {
	const id = useId();
	const dismissRef = useRef(dismiss);
	dismissRef.current = dismiss;
	const dismissed = useRef(false);

	useEffect(() => {
		if (isOpen) dismissed.current = false;
	}, [isOpen]);

	useEffect(() => {
		if (!isOpen) return;

		const requestClose = () => {
			if (dismissed.current) return;
			dismissed.current = true;
			dismissRef.current();
		};

		const onPointerDown = (event: PointerEvent) => {
			const target = event.target;
			if (!(target instanceof Node)) return;
			if (rootRef.current?.contains(target)) return;
			// Another menu's trigger handles its own open, which closes this one.
			if (target instanceof Element && target.closest("[data-dropdown-trigger]")) return;
			requestClose();
		};

		const onOtherOpen = (event: Event) => {
			if ((event as CustomEvent<string>).detail !== id) requestClose();
		};

		document.addEventListener("pointerdown", onPointerDown);
		window.addEventListener(DROPDOWN_OPEN, onOtherOpen);
		window.dispatchEvent(new CustomEvent(DROPDOWN_OPEN, { detail: id }));
		return () => {
			document.removeEventListener("pointerdown", onPointerDown);
			window.removeEventListener(DROPDOWN_OPEN, onOtherOpen);
		};
	}, [isOpen, id, rootRef]);
}

export const dropdownMenuStyles = {
	container: "z-50 min-w-[220px] rounded-lg border border-rich-brown bg-grey-white shadow-lg py-2 overflow-y-auto",
	divider: "my-1 border-t border-soft-grey",
};

const MENU_GAP = 4;
const VIEWPORT_PAD = 8;

interface DropdownPosition {
	/** Set when the menu opens downward from the trigger. */
	top?: number;
	/** Set when the menu opens upward from the trigger. */
	bottom?: number;
	/** Distance from the viewport's right edge — set when the menu hangs from the trigger's right edge. */
	right?: number;
	/** Distance from the viewport's left edge — set when the menu hangs from the trigger's left edge. */
	left?: number;
	maxHeight: number;
	maxWidth: number;
}

/** Keep a fixed menu inside the window: open the side that fits, and scroll when the list is longer than that side. */
function placeDropdown(trigger: DOMRect, menu: HTMLElement, align: "left" | "right"): DropdownPosition {
	const spaceBelow = Math.max(0, window.innerHeight - trigger.bottom - MENU_GAP - VIEWPORT_PAD);
	const spaceAbove = Math.max(0, trigger.top - MENU_GAP - VIEWPORT_PAD);
	const contentHeight = menu.scrollHeight;
	const fitsBelow = contentHeight <= spaceBelow;
	const fitsAbove = contentHeight <= spaceAbove;
	const openUp = fitsBelow ? false : fitsAbove ? true : spaceAbove > spaceBelow;
	const maxHeight = Math.max(0, Math.round(openUp ? spaceAbove : spaceBelow));
	const maxWidth = Math.max(0, Math.round(window.innerWidth - VIEWPORT_PAD * 2));
	const width = Math.min(menu.offsetWidth, maxWidth);

	if (align === "left") {
		let left = trigger.left;
		if (width && left + width > window.innerWidth - VIEWPORT_PAD) {
			left = window.innerWidth - VIEWPORT_PAD - width;
		}
		if (left < VIEWPORT_PAD) left = VIEWPORT_PAD;
		const edge = { left: Math.round(left), maxHeight, maxWidth };
		return openUp
			? { ...edge, bottom: Math.round(window.innerHeight - trigger.top + MENU_GAP) }
			: { ...edge, top: Math.round(trigger.bottom + MENU_GAP) };
	}

	let right = window.innerWidth - trigger.right;
	if (width && right + width > window.innerWidth - VIEWPORT_PAD) {
		right = window.innerWidth - VIEWPORT_PAD - width;
	}
	if (right < VIEWPORT_PAD) right = VIEWPORT_PAD;
	const edge = { right: Math.round(right), maxHeight, maxWidth };
	return openUp
		? { ...edge, bottom: Math.round(window.innerHeight - trigger.top + MENU_GAP) }
		: { ...edge, top: Math.round(trigger.bottom + MENU_GAP) };
}

function samePosition(a: DropdownPosition | null, b: DropdownPosition) {
	return !!a && a.top === b.top && a.bottom === b.bottom && a.left === b.left && a.right === b.right
		&& a.maxHeight === b.maxHeight && a.maxWidth === b.maxWidth;
}

interface DropdownMenuProps {
	isOpen: boolean;
	onClose: () => void;
	trigger: ReactNode;
	children: ReactNode;
	triggerClassName?: string;
	triggerAriaLabel?: string;
	/** Extra classes appended to the dropdown container — use to override min-w or set a fixed width. */
	containerClassName?: string;
	/** Which trigger edge the menu lines up with: "right" (default, for nav menus) or "left" (for triggers on the left of the page). */
	align?: "left" | "right";
}

export function DropdownMenu({
	isOpen,
	onClose,
	trigger,
	children,
	triggerClassName = "p-2 hover:opacity-80 rounded transition-opacity",
	triggerAriaLabel = "Menu",
	containerClassName = "",
	align = "right",
}: DropdownMenuProps) {
	const rootRef = useRef<HTMLDivElement>(null);
	const buttonRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);
	useOneOpenMenu(isOpen, onClose, rootRef);

	useLayoutEffect(() => {
		if (!isOpen) {
			setDropdownPosition((prev) => (prev === null ? prev : null));
			return;
		}
		const button = buttonRef.current;
		const menu = menuRef.current;
		if (!button || !menu) return;

		const place = () => {
			const next = placeDropdown(button.getBoundingClientRect(), menu, align);
			setDropdownPosition((prev) => (samePosition(prev, next) ? prev : next));
		};

		place();
		// Content can arrive after open (a loaded list). Ignore scrolling inside the menu itself.
		const observer = new ResizeObserver(place);
		observer.observe(menu);
		const onScroll = (event: Event) => {
			if (event.target instanceof Node && menu.contains(event.target)) return;
			place();
		};
		window.addEventListener("resize", place);
		window.addEventListener("scroll", onScroll, true);
		return () => {
			observer.disconnect();
			window.removeEventListener("resize", place);
			window.removeEventListener("scroll", onScroll, true);
		};
	}, [isOpen, align]);

	return (
		<div ref={rootRef} className="relative flex items-center">
			<button
				ref={buttonRef}
				type="button"
				data-dropdown-trigger=""
				onClick={onClose}
				className={triggerClassName}
				aria-label={triggerAriaLabel}
				aria-expanded={isOpen}
			>
				{trigger}
			</button>

			{isOpen && (
				<div
					ref={menuRef}
					className={`${dropdownMenuStyles.container} ${containerClassName}`}
					style={{
						position: "fixed",
						visibility: dropdownPosition ? "visible" : "hidden",
						top: dropdownPosition?.top,
						bottom: dropdownPosition?.bottom,
						right: dropdownPosition?.right,
						left: dropdownPosition?.left,
						maxHeight: dropdownPosition?.maxHeight,
						maxWidth: dropdownPosition?.maxWidth,
					}}
					role="menu"
				>
					{children}
				</div>
			)}
		</div>
	);
}
