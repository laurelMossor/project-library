"use client";

interface ToggleProps {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	description?: string;
	disabled?: boolean;
}

/**
 * An accessible on/off switch (role="switch"). The project's first toggle primitive — settings rows that
 * flip a single boolean use this instead of a radio-pair. Label + optional description sit left, the
 * switch right.
 */
export function Toggle({ checked, onChange, label, description, disabled = false }: ToggleProps) {
	return (
		<div className="flex items-center justify-between gap-4 py-3">
			<div className="min-w-0">
				<p className="text-sm font-medium text-rich-brown">{label}</p>
				{description ? <p className="text-xs text-misty-forest">{description}</p> : null}
			</div>
			<button
				type="button"
				role="switch"
				aria-checked={checked}
				aria-label={label}
				disabled={disabled}
				onClick={() => onChange(!checked)}
				className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-moss-green ${
					checked ? "bg-moss-green" : "bg-ash-green"
				} ${disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
			>
				<span
					className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition-transform ${
						checked ? "translate-x-5" : "translate-x-0.5"
					}`}
				/>
			</button>
		</div>
	);
}
