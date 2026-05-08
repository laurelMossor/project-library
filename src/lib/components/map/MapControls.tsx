"use client";

import { useState } from "react";
import { LocationSearchInput, type LocationResult } from "./LocationSearchInput";

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

type MapControlsProps = {
	locationLabel: string;
	radiusMiles: number;
	onLocationSelect: (result: LocationResult) => void;
	onRadiusChange: (miles: number) => void;
	onClear: () => void;
	hasActiveFilter: boolean;
};

export function MapControls({
	locationLabel,
	radiusMiles,
	onLocationSelect,
	onRadiusChange,
	onClear,
	hasActiveFilter,
}: MapControlsProps) {
	const [inputValue, setInputValue] = useState(locationLabel);

	const handleSelect = (result: LocationResult) => {
		setInputValue(result.displayName);
		onLocationSelect(result);
	};

	return (
		<div className="mb-4">
			<p className="text-xs font-semibold uppercase tracking-wider text-misty-forest mb-2">
				Search by area
			</p>
			<div className="flex flex-wrap items-start gap-3">
				<div className="w-64">
					<LocationSearchInput
						value={inputValue}
						onChange={setInputValue}
						onSelect={handleSelect}
						placeholder="City, zip, or address..."
					/>
				</div>

				<div className="flex gap-1.5 items-center pt-1.5">
					{RADIUS_OPTIONS.map((r) => (
						<button
							key={r}
							type="button"
							onClick={() => onRadiusChange(r)}
							className={`text-sm font-bold px-2 py-1 rounded cursor-pointer transition-shadow hover:shadow-glow-sm ${
								radiusMiles === r
									? "bg-melon-green text-rich-brown"
									: "bg-ash-green text-dusty-grey"
							}`}
						>
							{r} mi
						</button>
					))}
				</div>

				{hasActiveFilter && (
					<button
						type="button"
						onClick={() => {
							onClear();
							setInputValue("");
						}}
						className="text-sm text-misty-forest hover:text-rich-brown cursor-pointer transition-colors pt-2"
					>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}
