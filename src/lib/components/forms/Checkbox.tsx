"use client";

type CheckboxProps = {
	checked: boolean;
	onChange: (next: boolean) => void;
	label: string;
	description?: string;
	disabled?: boolean;
	/** Keep the label for assistive tech but don't paint it (the row already shows a name). */
	hideLabel?: boolean;
};

/**
 * A labeled checkbox. Settings and composers that pick one or more options use this
 * instead of a raw input, so the hit target and the palette stay consistent.
 */
export function Checkbox({ checked, onChange, label, description, disabled = false, hideLabel = false }: CheckboxProps) {
	return (
		<label className={`flex items-start gap-3 ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				aria-label={label}
				onChange={(e) => onChange(e.target.checked)}
				className="mt-0.5 accent-moss-green"
			/>
			{!hideLabel && (
				<span className="min-w-0">
					<span className="block text-sm font-medium text-rich-brown">{label}</span>
					{description ? <span className="block text-xs text-misty-forest">{description}</span> : null}
				</span>
			)}
		</label>
	);
}
