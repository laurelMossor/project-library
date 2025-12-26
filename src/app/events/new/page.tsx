"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { InteractiveMap, geocodeAddress } from "@/lib/components/map/InteractiveMap";

const MAX_TAGS = 10;

function normalizeTags(tagInput: string): string[] {
	return tagInput
		.split(",")
		.map((tag) => tag.trim())
		.filter((tag) => tag.length > 0)
		.slice(0, MAX_TAGS);
}

export default function NewEventPage() {
	const router = useRouter();
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [dateTime, setDateTime] = useState("");
	const [location, setLocation] = useState("");
	const [latitude, setLatitude] = useState<number | null>(null);
	const [longitude, setLongitude] = useState<number | null>(null);
	const [tags, setTags] = useState("");
	const [geocoding, setGeocoding] = useState(false);
	const [geocodeError, setGeocodeError] = useState("");

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

	const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
		event.preventDefault();
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
		if (Number.isNaN(scheduledDate.getTime()) || scheduledDate.getTime() <= Date.now()) {
			setError("Event date must be in the future");
			setSubmitting(false);
			return;
		}

		if (!trimmedLocation) {
			setError("Event location is required");
			setSubmitting(false);
			return;
		}

		// Coordinates are optional - if not set, event will still be created without map display
		const parsedLatitude = latitude ?? undefined;
		const parsedLongitude = longitude ?? undefined;

		try {
			const response = await fetch("/api/events", {
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
					router.push("/login?callbackUrl=/events/new");
					return;
				}
				setError(data.error || "Failed to create event");
				setSubmitting(false);
				return;
			}

			const eventData = await response.json();
			router.push(`/events/${eventData.id}`);
		} catch (err) {
			console.error("Failed to create event", err);
			setError("Failed to create event");
			setSubmitting(false);
		}
	};

	return (
		<main className="flex min-h-screen items-start justify-center p-4">
			<form
				onSubmit={handleSubmit}
				className="w-full max-w-2xl space-y-4 rounded border border-gray-200 bg-white p-6 shadow-sm"
			>
				<h1 className="text-2xl font-semibold">Create Event</h1>

				{error && <p className="text-sm font-medium text-red-600">{error}</p>}

				<div>
					<label htmlFor="title" className="block text-sm font-medium mb-1">
						Title <span className="text-red-500">*</span>
					</label>
					<input
						id="title"
						type="text"
						value={title}
						onChange={(event) => setTitle(event.target.value)}
						placeholder="Event title"
						required
						maxLength={150}
						className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none"
					/>
				</div>

				<div>
					<label htmlFor="description" className="block text-sm font-medium mb-1">
						Description <span className="text-red-500">*</span>
					</label>
					<textarea
						id="description"
						value={description}
						onChange={(event) => setDescription(event.target.value)}
						placeholder="Describe the event..."
						required
						rows={6}
						maxLength={5000}
						className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none"
					/>
				</div>

				<div>
					<label htmlFor="datetime" className="block text-sm font-medium mb-1">
						Date &amp; Time <span className="text-red-500">*</span>
					</label>
					<input
						id="datetime"
						type="datetime-local"
						value={dateTime}
						onChange={(event) => setDateTime(event.target.value)}
						min={minDateTime}
						required
						className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none"
					/>
				</div>

				<div>
					<label htmlFor="location" className="block text-sm font-medium mb-1">
						Location <span className="text-red-500">*</span>
					</label>
					<div className="flex gap-2">
						<input
							id="location"
							type="text"
							value={location}
							onChange={(event) => setLocation(event.target.value)}
							placeholder="123 Main St, City, Country"
							required
							maxLength={255}
							className="flex-1 rounded border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none"
						/>
						<button
							type="button"
							onClick={handleGeocodeAddress}
							disabled={geocoding || !location.trim()}
							className="rounded border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
						>
							{geocoding ? "Searching..." : "Find on Map"}
						</button>
					</div>
					{geocodeError && <p className="mt-1 text-xs text-red-600">{geocodeError}</p>}
					<p className="mt-1 text-xs text-gray-500">
						Enter an address and click "Find on Map" to locate it, or use the map below to set coordinates.
					</p>
				</div>

				<div>
					<label className="block text-sm font-medium mb-1">Set Location on Map</label>
					<InteractiveMap
						latitude={latitude}
						longitude={longitude}
						onLocationChange={handleLocationChange}
					/>
					{latitude !== null && longitude !== null && (
						<p className="mt-2 text-xs text-gray-500">
							Coordinates: {latitude.toFixed(6)}, {longitude.toFixed(6)}
						</p>
					)}
				</div>

				<div>
					<label htmlFor="tags" className="block text-sm font-medium mb-1">
						Tags (optional)
					</label>
					<input
						id="tags"
						type="text"
						value={tags}
						onChange={(event) => setTags(event.target.value)}
						placeholder="Tag1, Tag2, Tag3"
						className="w-full rounded border border-gray-300 px-3 py-2 text-base focus:border-black focus:outline-none"
					/>
					<p className="text-xs text-gray-500">
						Separate tags with commas. You can add up to {MAX_TAGS} tags.
					</p>
				</div>

				<div className="flex flex-wrap gap-3">
					<button
						type="submit"
						disabled={submitting}
						className="rounded bg-black px-4 py-2 text-white transition hover:bg-gray-900 disabled:opacity-50"
					>
						{submitting ? "Creating event…" : "Create event"}
					</button>
					<button
						type="button"
						onClick={() => router.back()}
						className="rounded border border-gray-400 px-4 py-2 text-gray-700 transition hover:border-black hover:text-black"
					>
						Cancel
					</button>
				</div>
			</form>
		</main>
	);
}

