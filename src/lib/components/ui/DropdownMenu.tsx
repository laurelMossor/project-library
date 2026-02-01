"use client";

import { useRef, useLayoutEffect, useState, ReactNode } from "react";

export const dropdownMenuStyles = {
	container: "z-50 min-w-[220px] rounded-lg border border-rich-brown bg-grey-white shadow-lg py-2",
	backdrop: "fixed inset-0 z-40",
	divider: "my-1 border-t border-soft-grey",
};

interface DropdownPosition {
	top: number;
	right: number;
}

interface DropdownMenuProps {
	isOpen: boolean;
	onClose: () => void;
	trigger: ReactNode;
	children: ReactNode;
	triggerClassName?: string;
	triggerAriaLabel?: string;
}

export function DropdownMenu({
	isOpen,
	onClose,
	trigger,
	children,
	triggerClassName = "p-2 hover:opacity-80 rounded transition-opacity",
	triggerAriaLabel = "Menu",
}: DropdownMenuProps) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

	useLayoutEffect(() => {
		if (!isOpen || !buttonRef.current || typeof window === "undefined") return;
		const rect = buttonRef.current.getBoundingClientRect();
		setDropdownPosition({
			top: rect.bottom + 4,
			right: window.innerWidth - rect.right,
		});
	}, [isOpen]);

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
							className={dropdownMenuStyles.container}
							style={{
								position: "fixed",
								top: dropdownPosition.top,
								right: dropdownPosition.right,
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
