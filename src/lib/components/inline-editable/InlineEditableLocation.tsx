"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { EventMap } from "@/lib/components/map/EventMap";
import { InteractiveMap, geocodeAddress } from "@/lib/components/map/InteractiveMap";

type InlineEditableLocationProps = {
	value: string;
	latitude: number | null;
	longitude: number | null;
	/** Used as the map pin label. */
	mapTitle?: string | null;
	canEdit: boolean;
	/**
	 * Called with the trimmed location string and resolved coordinates when the
	 * user clicks Save. Throw to show an inline error; return normally to close.
	 */
	onCommit: (location: string, latitude: number | null, longitude: number | null) => Promise<void>;
};

export function InlineEditableLocation({
	value,
	latitude,
	longitude,
	mapTitle,
	canEdit,
	onCommit,
}: InlineEditableLocationProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [editLocation, setEditLocation] = useState("");
	const [editLatitude, setEditLatitude] = useState<number | null>(null);
	const [editLongitude, setEditLongitude] = useState<number | null>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [geocoding, setGeocoding] = useState(false);

	const handleGeocode = async () => {
		if (!editLocation.trim()) return;
		setGeocoding(true);
		try {
			const coords = await geocodeAddress(editLocation.trim());
			if (coords) {
				setEditLatitude(coords.lat);
				setEditLongitude(coords.lng);
			}
		} catch {
			// Geocoding is optional — silently ignore failures
		} finally {
			setGeocoding(false);
		}
	};

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				setEditLocation(value);
				setEditLatitude(latitude);
				setEditLongitude(longitude);
				setError("");
				setIsEditing(true);
			}}
			onSave={async () => {
				setSaving(true);
				setError("");
				try {
					await onCommit(editLocation.trim(), editLatitude, editLongitude);
					setIsEditing(false);
				} catch (err) {
					setError(err instanceof Error ? err.message : "Failed to save");
				} finally {
					setSaving(false);
				}
			}}
			onCancel={() => { setIsEditing(false); setError(""); }}
			saving={saving}
			error={error}
			displayContent={
				<div className="space-y-3">
					<div className="rounded-xl border border-gray-200 p-4">
						<p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-1">Location</p>
						<p className="text-lg font-medium text-rich-brown">
							{value || (canEdit ? "Add a location" : "TBD")}
						</p>
					</div>
					{latitude != null && longitude != null && (
						<EventMap latitude={latitude} longitude={longitude} title={mapTitle || undefined} />
					)}
				</div>
			}
			editContent={
				<div className="space-y-3">
					<div className="flex gap-2">
						<input
							type="text"
							value={editLocation}
							onChange={(e) => setEditLocation(e.target.value)}
							placeholder="123 Main St, City, Country"
							maxLength={255}
							className="flex-1 border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
						<button
							type="button"
							onClick={handleGeocode}
							disabled={geocoding || !editLocation.trim()}
							className="px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
						>
							{geocoding ? "Searching..." : "Find on Map"}
						</button>
					</div>
					<InteractiveMap
						latitude={editLatitude}
						longitude={editLongitude}
						onLocationChange={(lat, lng) => {
							setEditLatitude(lat);
							setEditLongitude(lng);
						}}
					/>
					{editLatitude != null && editLongitude != null && (
						<p className="text-xs text-gray-500">
							Coordinates: {editLatitude.toFixed(6)}, {editLongitude.toFixed(6)}
						</p>
					)}
				</div>
			}
		/>
	);
}
