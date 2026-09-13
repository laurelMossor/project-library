"use client";

import { useState } from "react";
import { LocationSearchInput } from "@/lib/components/map/LocationSearchInput";
import { EventMap } from "@/lib/components/map/EventMap";
import { InteractiveMap } from "@/lib/components/map/InteractiveMap";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { Button } from "@/lib/components/ui/Button";

type LocationFieldProps = {
	location: string;
	latitude: number | null;
	longitude: number | null;
	onChange: (next: { location: string; latitude: number | null; longitude: number | null }) => void;
	autoFocus?: boolean;
	/**
	 * Initial map disclosure. `true` shows the draggable map immediately (single-instance
	 * contexts, e.g. the event editor). `false` (default) shows a cheap static preview with an
	 * "Adjust pin" button that reveals the draggable map — for list contexts where many rows
	 * render at once (e.g. the submissions review) so only the edited row mounts Leaflet.
	 */
	interactiveByDefault?: boolean;
};

/**
 * The shared "search a place + confirm its pin" field, used by the event editor and the
 * Poster Catcher submissions review. One place for the invariant that **editing the location
 * text invalidates the pin** (`onChange` clears coordinates; only picking a suggestion or
 * moving the marker sets them), so the two forms can never ship a location string that
 * disagrees with its coordinates.
 */
export function LocationField({
	location,
	latitude,
	longitude,
	onChange,
	autoFocus,
	interactiveByDefault = false,
}: LocationFieldProps) {
	const [adjusting, setAdjusting] = useState(interactiveByDefault);
	const hasCoords = latitude != null && longitude != null;

	return (
		<div className="space-y-2">
			<LocationSearchInput
				value={location}
				// Editing the text by hand invalidates the previously-resolved pin.
				onChange={(value) => onChange({ location: value, latitude: null, longitude: null })}
				onSelect={(result) => onChange({ location: result.displayName, latitude: result.lat, longitude: result.lng })}
				autoFocus={autoFocus}
			/>
			{hasCoords ? (
				adjusting ? (
					<InteractiveMap
						latitude={latitude}
						longitude={longitude}
						onLocationChange={(lat, lng) => onChange({ location, latitude: lat, longitude: lng })}
					/>
				) : (
					<div className="space-y-2">
						<EventMap latitude={latitude} longitude={longitude} heightClassName="h-40" widthClassName="w-full max-w-sm" />
						<Button variant="secondary" size="sm" onClick={() => setAdjusting(true)}>
							Adjust pin
						</Button>
					</div>
				)
			) : (
				<DashedPlaceholder className="p-6 flex justify-center">
					<p className="text-sm text-misty-forest text-center">
						Search for a location above and pick a suggestion to drop the pin.
					</p>
				</DashedPlaceholder>
			)}
		</div>
	);
}
