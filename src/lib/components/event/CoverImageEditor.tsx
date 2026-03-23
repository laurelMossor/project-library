"use client";

import { useRef, useState } from "react";
import { useImageUpload } from "@/lib/hooks/useImageUpload";

type CoverImageEditorProps = {
	eventId: string;
	imageUrl?: string | null;
	canEdit: boolean;
	onImageUploaded?: (imageUrl: string) => void;
};

/**
 * Cover image area for the event page.
 * Shows a gradient placeholder when no image is set.
 * Owner can click to upload a cover image.
 */
export function CoverImageEditor({ eventId, imageUrl, canEdit, onImageUploaded }: CoverImageEditorProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const { imageFile, imagePreview, error: imageError, handleImageChange } = useImageUpload(imageUrl);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	const displayUrl = imagePreview || imageUrl;

	const handleUpload = async (file: File) => {
		setUploading(true);
		setError("");

		try {
			// Upload image to storage
			const formData = new FormData();
			formData.append("file", file);

			const uploadRes = await fetch("/api/upload?folder=event-covers", {
				method: "POST",
				body: formData,
			});

			if (!uploadRes.ok) {
				const data = await uploadRes.json().catch(() => ({}));
				setError(data.error || "Failed to upload image");
				setUploading(false);
				return;
			}

			const uploadData = await uploadRes.json();

			// Attach image to event
			const attachRes = await fetch("/api/image-attachments", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					imageId: uploadData.id,
					type: "EVENT",
					targetId: eventId,
				}),
			});

			if (!attachRes.ok) {
				const data = await attachRes.json().catch(() => ({}));
				setError(data.error || "Failed to attach image");
				setUploading(false);
				return;
			}

			onImageUploaded?.(uploadData.url);
		} catch {
			setError("Failed to upload image");
		} finally {
			setUploading(false);
		}
	};

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		handleImageChange(e);
		const file = e.target.files?.[0];
		if (file) {
			await handleUpload(file);
		}
	};

	return (
		<div className="relative w-full overflow-hidden rounded-t-lg">
			{displayUrl ? (
				<img
					src={displayUrl}
					alt="Event cover"
					className="h-80 w-full object-cover"
				/>
			) : (
				// Gradient placeholder
				<div className="h-80 w-full bg-gradient-to-br from-melon-green via-ash-green to-moss-green" />
			)}

			{canEdit && (
				<>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						disabled={uploading}
						className="absolute bottom-4 right-4 px-4 py-2 text-sm font-medium bg-white/90 backdrop-blur-sm text-gray-800 rounded-lg shadow-sm hover:bg-white transition-colors disabled:opacity-50"
					>
						{uploading ? "Uploading..." : displayUrl ? "Change cover" : "Add cover image"}
					</button>
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						onChange={handleFileChange}
						className="hidden"
					/>
				</>
			)}

			{(error || imageError) && (
				<p className="absolute bottom-4 left-4 text-sm text-white bg-alert-red/90 px-3 py-1 rounded">
					{error || imageError}
				</p>
			)}
		</div>
	);
}
