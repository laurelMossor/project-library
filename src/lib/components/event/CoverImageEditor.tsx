"use client";

import { useEffect, useRef, useState } from "react";
import { validateImageFile, compressImage, createImagePreview, MAX_IMAGE_SIZE } from "@/lib/utils/image";
import { useInlineEditSessionContext } from "@/lib/components/inline-editable/InlineEditSession";

type CoverImageEditorProps = {
	imageUrl?: string | null;
	canEdit: boolean;
};

/**
 * Cover image area for the event page.
 * Shows a gradient placeholder when no image is set.
 *
 * In edit mode, the file is held in the InlineEditSession as a dirty file
 * ("cover") — no upload happens until the user clicks Save/Save-and-publish.
 * The local data-URL preview is shown immediately on pick. Cancelling the
 * session reverts the preview to the committed image URL (nothing was uploaded).
 */
export function CoverImageEditor({ imageUrl, canEdit }: CoverImageEditorProps) {
	const session = useInlineEditSessionContext();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [localPreview, setLocalPreview] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [wasCompressed, setWasCompressed] = useState(false);

	// When the session cancels, drop the local preview (the File was cleared from session too)
	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setLocalPreview(null);
		setError("");
		setWasCompressed(false);
	// cancelRevision is the only intended trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const displayUrl = localPreview ?? imageUrl;

	const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		setError("");
		setWasCompressed(false);

		const validation = validateImageFile(file);
		let processedFile = file;

		if (!validation.valid) {
			if (file.size <= MAX_IMAGE_SIZE) {
				setError(validation.error || "Invalid image file");
				return;
			}
			// Too large but valid type — try compression
			try {
				processedFile = await compressImage(file);
				setWasCompressed(true);
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to compress image");
				return;
			}
		}

		try {
			const preview = await createImagePreview(processedFile);
			setLocalPreview(preview);
			// Register the file with the session — upload deferred to commit time
			session?.setDirtyFile("cover", processedFile);
		} catch {
			setError("Failed to preview image");
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
				<div className="h-80 w-full bg-gradient-to-br from-melon-green via-ash-green to-moss-green" />
			)}

			{canEdit && (
				<>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="absolute bottom-4 right-4 px-4 py-2 text-sm font-medium bg-white/90 backdrop-blur-sm text-gray-800 rounded-lg shadow-sm hover:bg-white transition-colors"
					>
						{displayUrl ? "Change cover" : "Add cover image"}
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

			{error && (
				<p className="absolute bottom-4 left-4 text-sm text-white bg-alert-red/90 px-3 py-1 rounded">
					{error}
				</p>
			)}
			{wasCompressed && !error && (
				<p className="absolute bottom-4 left-4 text-xs text-amber-600 bg-white/90 px-3 py-1 rounded">
					Image was automatically resized to fit the 5MB limit
				</p>
			)}
		</div>
	);
}
