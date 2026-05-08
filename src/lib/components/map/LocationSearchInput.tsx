"use client";

import { useEffect, useRef, useState } from "react";

type NominatimResult = {
	display_name: string;
	lat: string;
	lon: string;
};

export type LocationResult = {
	displayName: string;
	lat: number;
	lng: number;
};

type LocationSearchInputProps = {
	value: string;
	onChange: (value: string) => void;
	onSelect: (result: LocationResult) => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
};

export function LocationSearchInput({
	value,
	onChange,
	onSelect,
	placeholder = "Search for a location...",
	className = "",
	autoFocus = false,
}: LocationSearchInputProps) {
	const [suggestions, setSuggestions] = useState<NominatimResult[]>([]);
	const [showDropdown, setShowDropdown] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		const query = value.trim();
		if (query.length < 3) {
			setSuggestions([]);
			return;
		}

		const timer = setTimeout(async () => {
			try {
				const res = await fetch(
					`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`,
					{ headers: { "User-Agent": "ProjectLibrary/1.0" } }
				);
				const data: NominatimResult[] = res.ok ? await res.json() : [];
				setSuggestions(data);
				setShowDropdown(data.length > 0);
			} catch {
				setSuggestions([]);
			}
		}, 350);

		return () => clearTimeout(timer);
	}, [value]);

	return (
		<div className="relative">
			<input
				ref={inputRef}
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onKeyDown={(e) => {
					if (e.key === "Enter") e.preventDefault();
					if (e.key === "Escape") setShowDropdown(false);
				}}
				onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
				onFocus={() => { if (suggestions.length > 0) setShowDropdown(true); }}
				placeholder={placeholder}
				maxLength={255}
				className={`w-full border border-soft-grey rounded px-3 py-2 text-sm text-rich-brown bg-grey-white placeholder:text-dusty-grey focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown ${className}`}
				autoFocus={autoFocus}
			/>
			{showDropdown && suggestions.length > 0 && (
				<div className="absolute top-full left-0 right-0 z-20 mt-1 bg-grey-white border border-soft-grey rounded shadow-glow overflow-hidden">
					{suggestions.map((s, i) => (
						<button
							key={i}
							type="button"
							onMouseDown={(e) => {
								e.preventDefault();
								const result: LocationResult = {
									displayName: s.display_name,
									lat: parseFloat(s.lat),
									lng: parseFloat(s.lon),
								};
								onSelect(result);
								setShowDropdown(false);
								setSuggestions([]);
							}}
							className="w-full text-left px-3 py-2 text-sm text-rich-brown hover:bg-ash-green/50 border-b border-soft-grey last:border-0 truncate"
						>
							{s.display_name}
						</button>
					))}
				</div>
			)}
		</div>
	);
}
