"use client";

import { useState } from "react";
import { validateImageFile, createImagePreview, compressImage, MAX_IMAGE_SIZE } from "@/lib/utils/image";

type UseImageUploadResult = {
	imageFile: File | null;
	imagePreview: string | null;
	uploading: boolean;
	error: string;
	wasCompressed: boolean;
	setImageFile: (file: File | null) => void;
	handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	clearImage: () => void;
};

export function useImageUpload(existingImageUrl?: string | null): UseImageUploadResult {
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl || null);
	const [uploading] = useState(false);
	const [error, setError] = useState("");
	const [wasCompressed, setWasCompressed] = useState(false);

	const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
			setError("");
			setWasCompressed(false);
			return;
		}

		const validation = validateImageFile(file);

		if (validation.valid) {
			try {
				const preview = await createImagePreview(file);
				setImageFile(file);
				setImagePreview(preview);
				setError("");
				setWasCompressed(false);
			} catch {
				setError("Failed to create image preview");
				setImageFile(null);
				setImagePreview(existingImageUrl || null);
			}
			return;
		}

		// If type is invalid, don't attempt compression
		if (file.size <= MAX_IMAGE_SIZE) {
			setError(validation.error || "Invalid image file");
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
			return;
		}

		// File is too large but type is valid — try compression
		try {
			const compressed = await compressImage(file);
			const preview = await createImagePreview(compressed);
			setImageFile(compressed);
			setImagePreview(preview);
			setError("");
			setWasCompressed(true);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to compress image");
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
			setWasCompressed(false);
		}
	};

	const clearImage = () => {
		setImageFile(null);
		setImagePreview(existingImageUrl || null);
		setError("");
		setWasCompressed(false);
	};

	return {
		imageFile,
		imagePreview,
		uploading,
		error,
		wasCompressed,
		setImageFile,
		handleImageChange,
		clearImage,
	};
}

