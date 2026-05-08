"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { formatDateTime } from "@/lib/utils/datetime";

const TIMEZONE_OPTIONS = [
	{ label: "Pacific", value: "America/Los_Angeles" },
	{ label: "Mountain", value: "America/Denver" },
	{ label: "Central", value: "America/Chicago" },
	{ label: "Eastern", value: "America/New_York" },
	{ label: "Alaska", value: "America/Anchorage" },
	{ label: "Hawaii", value: "Pacific/Honolulu" },
	{ label: "UTC", value: "UTC" },
];

type InlineDateTimePickerProps = {
	eventId: string;
	eventDateTime: Date | string;
	eventTimezone?: string | null;
	canEdit: boolean;
	onSave: (dateTime: Date, timezone: string) => Promise<void>;
};

function toLocalDateTimeString(date: Date | string, timezone?: string | null): string {
	const d = typeof date === "string" ? new Date(date) : date;
	if (timezone) {
		const parts = new Intl.DateTimeFormat("en-CA", {
			timeZone: timezone,
			year: "numeric", month: "2-digit", day: "2-digit",
			hour: "2-digit", minute: "2-digit",
			hour12: false,
		}).formatToParts(d);
		const get = (type: string) => parts.find(p => p.type === type)?.value ?? "";
		return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
	}
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function localInputToUtc(localValue: string, timezone: string): Date {
	const [datePart, timePart] = localValue.split("T");
	const [year, month, day] = datePart.split("-").map(Number);
	const [hour, minute] = timePart.split(":").map(Number);

	const asUtcMs = Date.UTC(year, month - 1, day, hour, minute);
	const formatter = new Intl.DateTimeFormat("en-US", {
		timeZone: timezone,
		year: "numeric", month: "numeric", day: "numeric",
		hour: "numeric", minute: "numeric", second: "numeric",
		hour12: false,
	});
	const parts = formatter.formatToParts(new Date(asUtcMs));
	const get = (type: string) => {
		let v = parseInt(parts.find(p => p.type === type)?.value ?? "0", 10);
		if (type === "hour" && v === 24) v = 0;
		return v;
	};
	const localAsUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
	const offsetMs = localAsUtc - asUtcMs;
	return new Date(asUtcMs - offsetMs);
}

function detectBrowserTimezone(): string {
	const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
	if (TIMEZONE_OPTIONS.some(o => o.value === detected)) return detected;
	return "America/Los_Angeles";
}

export function InlineDateTimePicker({ eventDateTime, eventTimezone, canEdit, onSave }: InlineDateTimePickerProps) {
	const effectiveTz = eventTimezone || detectBrowserTimezone();
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(toLocalDateTimeString(eventDateTime, eventTimezone));
	const [timezone, setTimezone] = useState(effectiveTz);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const handleSave = async () => {
		const utcDate = localInputToUtc(value, timezone);
		if (isNaN(utcDate.getTime())) {
			setError("Invalid date");
			return;
		}
		setSaving(true);
		setError("");
		try {
			await onSave(utcDate, timezone);
			setIsEditing(false);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to save");
		} finally {
			setSaving(false);
		}
	};

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				const tz = eventTimezone || detectBrowserTimezone();
				setValue(toLocalDateTimeString(eventDateTime, tz));
				setTimezone(tz);
				setIsEditing(true);
			}}
			onCancel={() => {
				setIsEditing(false);
				setError("");
			}}
			displayContent={
				<p className="text-lg font-medium text-rich-brown">
					{formatDateTime(eventDateTime, eventTimezone)}
				</p>
			}
			editContent={
				<div>
					<div className="flex items-center gap-2">
						<input
							type="datetime-local"
							value={value}
							onChange={(e) => setValue(e.target.value)}
							className="flex-1 border border-gray-300 p-2 rounded text-lg"
							autoFocus
						/>
						<select
							value={timezone}
							onChange={(e) => setTimezone(e.target.value)}
							className="border border-gray-300 p-2 rounded text-sm"
						>
							{TIMEZONE_OPTIONS.map(({ label, value: tz }) => (
								<option key={tz} value={tz}>{label}</option>
							))}
						</select>
					</div>
					<div className="flex items-center gap-2 mt-2">
						<button
							type="button"
							onClick={handleSave}
							disabled={saving}
							className="px-3 py-1 text-sm font-medium text-white bg-moss-green rounded hover:bg-rich-brown transition-colors disabled:opacity-50"
						>
							{saving ? "Saving..." : "Save"}
						</button>
						<button
							type="button"
							onClick={() => { setIsEditing(false); setError(""); }}
							disabled={saving}
							className="px-3 py-1 text-sm font-medium text-warm-grey border border-soft-grey rounded hover:bg-soft-grey/20 transition-colors disabled:opacity-50"
						>
							Cancel
						</button>
					</div>
					{error && <p className="text-sm text-alert-red mt-1">{error}</p>}
				</div>
			}
		/>
	);
}
