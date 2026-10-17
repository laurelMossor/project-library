"use client";

import { useRef, useLayoutEffect, useState, ReactNode } from "react";

export const dropdownMenuStyles = {
	container: "z-50 min-w-[220px] rounded-lg border border-rich-brown bg-grey-white shadow-lg py-2",
	backdrop: "fixed inset-0 z-40",
	divider: "my-1 border-t border-soft-grey",
};

interface DropdownPosition {
	top: number;
	/** Distance from the viewport's right edge — set when the menu hangs from the trigger's right edge. */
	right?: number;
	/** Distance from the viewport's left edge — set when the menu hangs from the trigger's left edge. */
	left?: number;
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
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

	useLayoutEffect(() => {
		if (!isOpen || !buttonRef.current || typeof window === "undefined") return;
		const rect = buttonRef.current.getBoundingClientRect();
		setDropdownPosition(
			align === "left"
				? { top: rect.bottom + 4, left: rect.left }
				: { top: rect.bottom + 4, right: window.innerWidth - rect.right },
		);
	}, [isOpen, align]);

	const handleClose = () => {
		setDropdownPosition(null);
		onClose();
	};

	return (
		<div className="relative flex items-center">
			<button
				ref={buttonRef}
				onClick={onClose}
				className={triggerClassName}
				aria-label={triggerAriaLabel}
				aria-expanded={isOpen}
			>
				{trigger}
			</button>

			{isOpen && (
				<>
					<div
						className={dropdownMenuStyles.backdrop}
						aria-hidden="true"
						onClick={handleClose}
					/>
					{dropdownPosition && (
						<div
							className={`${dropdownMenuStyles.container} ${containerClassName}`}
							style={{
								position: "fixed",
								top: dropdownPosition.top,
								right: dropdownPosition.right,
								left: dropdownPosition.left,
							}}
							role="menu"
						>
							{children}
						</div>
					)}
				</>
			)}
		</div>
	);
}
