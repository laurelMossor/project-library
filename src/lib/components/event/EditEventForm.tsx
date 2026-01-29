"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { InteractiveMap, geocodeAddress } from "@/lib/components/map/InteractiveMap";
import { EventItem } from "@/lib/types/event";
import { updateEvent } from "@/lib/utils/event-client";
import { FormLayout } from "@/lib/components/layout/FormLayout";
import { FormField } from "@/lib/components/forms/FormField";
import { FormInput } from "@/lib/components/forms/FormInput";
import { FormTextarea } from "@/lib/components/forms/FormTextarea";
import { FormError } from "@/lib/components/forms/FormError";
import { FormActions } from "@/lib/components/forms/FormActions";
import { Button } from "@/lib/components/ui/Button";
import { API_EVENTS, LOGIN_WITH_CALLBACK, EVENT_NEW, EVENT_DETAIL } from "@/lib/const/routes";

const MAX_TAGS = 10;

function normalizeTags(tagInput: string): string[] {
	return tagInput
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0)
		.slice(0, MAX_TAGS);
}

type Props = {
	event?: EventItem;
};

export function EditEventForm({ event }: Props) {
	const isEditMode = !!event;
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const [title, setTitle] = useState(event?.title || "");
	const [description, setDescription] = useState(event?.description || "");
	const [dateTime, setDateTime] = useState("");
	const [location, setLocation] = useState(event?.location || "");
	const [latitude, setLatitude] = useState<number | null>(event?.latitude ?? null);
	const [longitude, setLongitude] = useState<number | null>(event?.longitude ?? null);
	const [tags, setTags] = useState(event?.tags.join(", ") || "");
	const [geocoding, setGeocoding] = useState(false);
	const [geocodeError, setGeocodeError] = useState("");

	// Initialize datetime from event if editing
	useEffect(() => {
		if (event?.eventDateTime) {
			const eventDate = new Date(event.eventDateTime);
			const localDateTime = new Date(eventDate.getTime() - eventDate.getTimezoneOffset() * 60000)
				.toISOString()
				.slice(0, 16);
			setDateTime(localDateTime);
		}
	}, [event?.eventDateTime]);

	const minDateTime = new Date().toISOString().slice(0, 16);

	const handleLocationChange = (lat: number, lng: number) => {
		setLatitude(lat);
		setLongitude(lng);
		setGeocodeError("");
	};

	const handleGeocodeAddress = async () => {
		if (!location.trim()) {
			setGeocodeError("Please enter an address first");
			return;
		}

		setGeocoding(true);
		setGeocodeError("");

		try {
			const coords = await geocodeAddress(location.trim());
			if (coords) {
				setLatitude(coords.lat);
				setLongitude(coords.lng);
				setGeocodeError("");
			} else {
				setGeocodeError("Could not find location. Try adjusting the address or set location on the map.");
			}
		} catch (error) {
			setGeocodeError("Failed to geocode address. Please set location on the map instead.");
		} finally {
			setGeocoding(false);
		}
	};

	const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);

		const trimmedTitle = title.trim();
		const trimmedDescription = description.trim();
		const trimmedLocation = location.trim();

		if (!trimmedTitle) {
			setError("Title is required");
			setSubmitting(false);
			return;
		}

		if (!trimmedDescription) {
			setError("Description is required");
			setSubmitting(false);
			return;
		}

		if (!dateTime) {
			setError("Event date and time are required");
			setSubmitting(false);
			return;
		}

		const scheduledDate = new Date(dateTime);
		if (Number.isNaN(scheduledDate.getTime())) {
			setError("Invalid date");
			setSubmitting(false);
			return;
		}

		// For new events, date must be in the future
		if (!isEditMode && scheduledDate.getTime() <= Date.now()) {
			setError("Event date must be in the future");
			setSubmitting(false);
			return;
		}

		if (!trimmedLocation) {
			setError("Event location is required");
			setSubmitting(false);
			return;
		}

		// Coordinates are optional - if not set, event will still be created/updated without map display
		const parsedLatitude = isEditMode ? (latitude ?? null) : (latitude ?? undefined);
		const parsedLongitude = isEditMode ? (longitude ?? null) : (longitude ?? undefined);

		try {
			if (isEditMode && event) {
				// Update existing event
				await updateEvent(event.id, {
					title: trimmedTitle,
					description: trimmedDescription,
					dateTime: scheduledDate,
					location: trimmedLocation,
					latitude: parsedLatitude,
					longitude: parsedLongitude,
					tags: normalizeTags(tags),
				});

				router.push(EVENT_DETAIL(event.id));
			} else {
				// Create new event
				const response = await fetch(API_EVENTS, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						title: trimmedTitle,
						description: trimmedDescription,
						dateTime: scheduledDate.toISOString(),
						location: trimmedLocation,
						latitude: parsedLatitude,
						longitude: parsedLongitude,
						tags: normalizeTags(tags),
					}),
				});

				if (!response.ok) {
					const data = await response.json().catch(() => ({}));
					if (response.status === 401) {
						router.push(LOGIN_WITH_CALLBACK(EVENT_NEW));
						return;
					}
					setError(data.error || "Failed to create event");
					setSubmitting(false);
					return;
				}

				const eventData = await response.json();
				router.push(EVENT_DETAIL(eventData.id));
			}
		} catch (err) {
			console.error(`Failed to ${isEditMode ? "update" : "create"} event`, err);
			setError(err instanceof Error ? err.message : `Failed to ${isEditMode ? "update" : "create"} event`);
			setSubmitting(false);
		}
	};

	return (
		<FormLayout>
			<form onSubmit={handleSubmit} className="space-y-4">
				<h1 className="text-2xl font-bold">{isEditMode ? "Edit Event" : "Create Event"}</h1>

				<FormError error={error} />

				<FormField label="Title" htmlFor="title" required>
					<FormInput
						id="title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Event title"
						required
						maxLength={150}
					/>
				</FormField>

				<FormField label="Description" htmlFor="description" required>
					<FormTextarea
						id="description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Describe the event..."
						required
						rows={6}
						maxLength={5000}
					/>
				</FormField>

				<FormField label="Date & Time" htmlFor="datetime" required>
					<FormInput
						id="datetime"
						type="datetime-local"
						value={dateTime}
						onChange={(event) => setDateTime(event.target.value)}
						min={minDateTime}
						required
					/>
				</FormField>

				<FormField label="Location" htmlFor="location" required helpText="Enter an address and click 'Find on Map' to locate it, or use the map below to set coordinates.">
					<div className="flex gap-2">
						<FormInput
							id="location"
							type="text"
							value={location}
							onChange={(event) => setLocation(event.target.value)}
							placeholder="123 Main St, City, Country"
							required
							maxLength={255}
							className="flex-1"
							error={geocodeError}
						/>
						<Button
							type="button"
							onClick={handleGeocodeAddress}
							disabled={geocoding || !location.trim()}
							variant="secondary"
							size="sm"
						>
							{geocoding ? "Searching..." : "Find on Map"}
						</Button>
					</div>
				</FormField>

				<FormField label="Set Location on Map" helpText={latitude !== null && longitude !== null ? `Coordinates: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}` : undefined}>
					<InteractiveMap
						latitude={latitude}
						longitude={longitude}
						onLocationChange={handleLocationChange}
					/>
				</FormField>

				<FormField label="Tags" htmlFor="tags" helpText={`Separate tags with commas. You can add up to ${MAX_TAGS} tags.`}>
					<FormInput
						id="tags"
						type="text"
						value={tags}
						onChange={(event) => setTags(event.target.value)}
						placeholder="Tag1, Tag2, Tag3"
					/>
				</FormField>

				<FormActions
					submitLabel={isEditMode ? "Update event" : "Create event"}
					onCancel={() => {
						if (isEditMode && event) {
							router.push(EVENT_DETAIL(event.id));
						} else {
							router.back();
						}
					}}
					loading={submitting}
					disabled={submitting}
				/>
			</form>
		</FormLayout>
	);
}

