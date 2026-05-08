"use client";

import { useState } from "react";

const RADIUS_OPTIONS = [5, 10, 25, 50] as const;

type MapControlsProps = {
	locationLabel: string;
	radiusMiles: number;
	onLocationSearch: (query: string) => void;
	onRadiusChange: (miles: number) => void;
	onClear: () => void;
	isGeocoding: boolean;
	hasActiveFilter: boolean;
};

export function MapControls({
	locationLabel,
	radiusMiles,
	onLocationSearch,
	onRadiusChange,
	onClear,
	isGeocoding,
	hasActiveFilter,
}: MapControlsProps) {
	const [inputValue, setInputValue] = useState(locationLabel);

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const trimmed = inputValue.trim();
		if (trimmed) onLocationSearch(trimmed);
	};

	return (
		<div className="mb-4">
			<p className="text-xs font-semibold uppercase tracking-wider text-misty-forest mb-2">
				Search by area
			</p>
			<form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
				<div className="relative">
					<input
						type="text"
						value={inputValue}
						onChange={(e) => setInputValue(e.target.value)}
						placeholder="City, zip, or address..."
						className="border border-rich-brown bg-warm-grey pl-2 pr-8 py-1.5 text-grey-white rounded text-sm font-semibold placeholder:text-dusty-grey w-56"
					/>
					<button
						type="submit"
						disabled={isGeocoding || !inputValue.trim()}
						className="absolute right-1.5 top-1/2 -translate-y-1/2 text-dusty-grey hover:text-grey-white disabled:opacity-40 cursor-pointer disabled:cursor-default"
					>
						{isGeocoding ? (
							<span className="text-xs animate-pulse">...</span>
						) : (
							<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2.5">
								<circle cx="8.5" cy="8.5" r="6" />
								<path d="M13 13l4.5 4.5" strokeLinecap="round" />
							</svg>
						)}
					</button>
				</div>

				<div className="flex gap-1.5">
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
							style={{ WebkitAppearance: "none", appearance: "none", border: "none", margin: 0 }}
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
						className="text-sm text-misty-forest hover:text-rich-brown cursor-pointer transition-colors"
					>
						Clear
					</button>
				)}
			</form>
		</div>
	);
}
