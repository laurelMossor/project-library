"use client";

export type SelectorOption<T extends string> = {
	value: T;
	label: string;
	description: string;
};

type Props<T extends string> = {
	value: T;
	onChange: (value: T) => void;
	options: SelectorOption<T>[];
	/** Radio group name — must be unique per selector on the page. */
	name: string;
	legend?: string;
	/** If true, renders as a compact select; otherwise renders as a radio group. */
	compact?: boolean;
	disabled?: boolean;
};

export function VisibilitySelector<T extends string>({
	value,
	onChange,
	options,
	name,
	legend = "Visibility",
	compact = false,
	disabled = false,
}: Props<T>) {
	if (compact) {
		return (
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as T)}
				disabled={disabled}
				className="border rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
			>
				{options.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		);
	}

	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-medium mb-2">{legend}</legend>
			{options.map((opt) => (
				<label
					key={opt.value}
					className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-colors ${
						value === opt.value
							? "border-moss-green bg-moss-green/10"
							: "border-gray-200 hover:border-ash-green"
					} ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
				>
					<input
						type="radio"
						name={name}
						value={opt.value}
						checked={value === opt.value}
						onChange={() => onChange(opt.value)}
						disabled={disabled}
						className="mt-0.5 accent-moss-green"
					/>
					<div>
						<div className="text-sm font-medium">{opt.label}</div>
						<div className="text-xs text-gray-500">{opt.description}</div>
					</div>
				</label>
			))}
		</fieldset>
	);
}
