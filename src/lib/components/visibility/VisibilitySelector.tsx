"use client";

type Visibility = "PUBLIC" | "UNLISTED" | "PRIVATE";

type Option = {
	value: Visibility;
	label: string;
	description: string;
};

const OPTIONS: Option[] = [
	{
		value: "PUBLIC",
		label: "Public",
		description: "Visible in Explore and search. Anyone can see it.",
	},
	{
		value: "UNLISTED",
		label: "Unlisted",
		description: "Not in Explore or search. Anyone with the link can see it.",
	},
	{
		value: "PRIVATE",
		label: "Private",
		description: "Only visible to followers/members.",
	},
];

type Props = {
	value: Visibility;
	onChange: (value: Visibility) => void;
	/** If true, renders as a compact select; otherwise renders as a radio group. */
	compact?: boolean;
	disabled?: boolean;
};

export function VisibilitySelector({ value, onChange, compact = false, disabled = false }: Props) {
	if (compact) {
		return (
			<select
				value={value}
				onChange={(e) => onChange(e.target.value as Visibility)}
				disabled={disabled}
				className="border rounded px-2 py-1 text-sm bg-white disabled:opacity-50"
			>
				{OPTIONS.map((opt) => (
					<option key={opt.value} value={opt.value}>
						{opt.label}
					</option>
				))}
			</select>
		);
	}

	return (
		<fieldset className="space-y-2">
			<legend className="text-sm font-medium mb-2">Visibility</legend>
			{OPTIONS.map((opt) => (
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
						name="visibility"
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
