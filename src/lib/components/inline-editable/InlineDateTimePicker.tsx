"use client";

import { useEffect, useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { useInlineField } from "@/lib/hooks/useInlineField";
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
	eventDateTime: Date | string;
	eventTimezone?: string | null;
	canEdit: boolean;
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

/**
 * Batched date/time picker — changes commit with the shared InlineEditSession
 * Save/Save-and-publish bar, not immediately. Removes the standalone onSave
 * prop; eventDateTime and eventTimezone flow through session.dirtyFields as
 * "eventDateTime" (UTC Date) and "eventTimezone" (string).
 */
export function InlineDateTimePicker({ eventDateTime, eventTimezone, canEdit }: InlineDateTimePickerProps) {
	const { value: currentDateTime, setValue: setDateTime } = useInlineField<Date | string>(
		"eventDateTime",
		eventDateTime
	);
	const { value: currentTimezone, setValue: setTimezone } = useInlineField<string>(
		"eventTimezone",
		eventTimezone || detectBrowserTimezone()
	);

	const effectiveTz = (currentTimezone as string) || detectBrowserTimezone();

	// Local input state — the datetime-local string for the <input>. This is
	// reset to match the committed/dirty value on edit-start and on cancelRevision.
	const [isEditing, setIsEditing] = useState(false);
	const [localValue, setLocalValue] = useState(() =>
		toLocalDateTimeString(currentDateTime, effectiveTz)
	);
	const [localTz, setLocalTz] = useState(effectiveTz);

	// Keep localValue in sync when the session cancels (dirtyFields cleared)
	// or when the parent updates eventDateTime (e.g. after a save).
	useEffect(() => {
		if (!isEditing) {
			setLocalValue(toLocalDateTimeString(currentDateTime, effectiveTz));
			setLocalTz(effectiveTz);
		}
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [currentDateTime, effectiveTz]);

	const handleLocalChange = (newLocalValue: string, newTz: string) => {
		setLocalValue(newLocalValue);
		setLocalTz(newTz);
		const utcDate = localInputToUtc(newLocalValue, newTz);
		if (!isNaN(utcDate.getTime())) {
			setDateTime(utcDate);
			setTimezone(newTz);
		}
	};

	return (
		<InlineEditable
			canEdit={canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				const tz = (currentTimezone as string) || detectBrowserTimezone();
				setLocalValue(toLocalDateTimeString(currentDateTime, tz));
				setLocalTz(tz);
				setIsEditing(true);
			}}
			onCancel={() => setIsEditing(false)}
			displayContent={
				<p className="text-lg font-medium text-rich-brown">
					{formatDateTime(currentDateTime, currentTimezone as string | null | undefined)}
				</p>
			}
			editContent={
				<div className="flex items-center gap-2">
					<input
						type="datetime-local"
						value={localValue}
						onChange={(e) => handleLocalChange(e.target.value, localTz)}
						min="1000-01-01T00:00"
						max="9999-12-31T23:59"
						className="flex-1 border border-gray-300 p-2 rounded text-lg"
						autoFocus
					/>
					<select
						value={localTz}
						onChange={(e) => handleLocalChange(localValue, e.target.value)}
						className="border border-gray-300 p-2 rounded text-sm"
					>
						{TIMEZONE_OPTIONS.map(({ label, value: tz }) => (
							<option key={tz} value={tz}>{label}</option>
						))}
					</select>
				</div>
			}
		/>
	);
}
