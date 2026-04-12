"use client";

import { useState } from "react";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { formatDateTime } from "@/lib/utils/datetime";

type InlineDateTimePickerProps = {
	eventId: string;
	eventDateTime: Date | string;
	canEdit: boolean;
	onSave: (dateTime: Date) => Promise<void>;
};

function toLocalDateTimeString(date: Date | string): string {
	const d = typeof date === "string" ? new Date(date) : date;
	return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export function InlineDateTimePicker({ eventDateTime, canEdit, onSave }: InlineDateTimePickerProps) {
	const [isEditing, setIsEditing] = useState(false);
	const [value, setValue] = useState(toLocalDateTimeString(eventDateTime));
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const handleSave = async () => {
		const parsed = new Date(value);
		if (isNaN(parsed.getTime())) {
			setError("Invalid date");
			return;
		}
		setSaving(true);
		setError("");
		try {
			await onSave(parsed);
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
				setValue(toLocalDateTimeString(eventDateTime));
				setIsEditing(true);
			}}
			onSave={handleSave}
			onCancel={() => {
				setIsEditing(false);
				setError("");
			}}
			saving={saving}
			error={error}
			isolate
			displayContent={
				<p className="text-lg font-medium text-rich-brown">
					{formatDateTime(eventDateTime)}
				</p>
			}
			editContent={
				<input
					type="datetime-local"
					value={value}
					onChange={(e) => setValue(e.target.value)}
					className="w-full border border-gray-300 p-2 rounded text-lg"
					autoFocus
				/>
			}
		/>
	);
}
