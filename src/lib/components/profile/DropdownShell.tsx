"use client";

import { ReactNode } from "react";
import { TellMeMore } from "@/lib/components/tooltip/TellMeMore";

type Props = {
	label?: string;
	hint?: string;
	/** A caret shows only when this is more than one and the menu is closed. */
	optionCount: number;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/**
	 * Closed face. The whole face toggles the menu, and the caret sits on its right.
	 * When omitted, the caret sits on the label line and the menu stays hidden until then.
	 */
	trigger?: ReactNode;
	children: ReactNode;
};

/** Shared open/close shell for the profile pickers. */
export function DropdownShell({ label, hint, optionCount, open, onOpenChange, trigger, children }: Props) {
	const showCaret = !open && optionCount > 1;

	const menu = open && (
		<>
			<div className="fixed inset-0 z-10" onClick={() => onOpenChange(false)} />
			<div role="listbox" className="absolute top-full left-0 right-0 mt-1 z-20 bg-white border border-soft-grey rounded-lg shadow-lg py-1">
				{children}
			</div>
		</>
	);

	const labelRow = (label || hint || (!trigger && showCaret)) ? (
		<div className={`flex items-center gap-1.5 w-full ${trigger ? "mb-1" : ""}`}>
			{label && <span className="text-sm font-medium">{label}</span>}
			{!trigger && showCaret && (
				<button
					type="button"
					className="inline-flex h-6 w-6 items-center justify-center text-dusty-grey"
					aria-expanded={false}
					aria-haspopup="listbox"
					aria-label={`Show ${label ?? "options"}`}
					onClick={() => onOpenChange(true)}
				>
					<Caret />
				</button>
			)}
			{hint && <TellMeMore hint={hint} />}
		</div>
	) : null;

	if (!trigger) {
		return (
			<div className="relative">
				{labelRow}
				{menu}
			</div>
		);
	}

	return (
		<div>
			{labelRow}
			<div className="relative">
				{optionCount > 1 ? (
					<button
						type="button"
						onClick={() => onOpenChange(!open)}
						className="w-full text-left"
						aria-expanded={open}
						aria-haspopup="listbox"
					>
						<span className="relative block">
							{trigger}
							{showCaret && (
								<span className="absolute right-3 top-1/2 -translate-y-1/2 text-dusty-grey pointer-events-none">
									<Caret />
								</span>
							)}
						</span>
					</button>
				) : (
					trigger
				)}
				{menu}
			</div>
		</div>
	);
}

export function Caret() {
	return (
		<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" className="shrink-0">
			<path d="M2.5 4.5 L6 8 L9.5 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
		</svg>
	);
}
