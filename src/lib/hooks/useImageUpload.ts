"use client";

import { useState } from "react";
import { validateImageFile, createImagePreview } from "@/lib/utils/image";

type UseImageUploadResult = {
	imageFile: File | null;
	imagePreview: string | null;
	uploading: boolean;
	error: string;
	setImageFile: (file: File | null) => void;
	handleImageChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
	clearImage: () => void;
};

/**
 * Hook for handling image upload with validation and preview
 * @param existingImageUrl - Optional existing image URL to show initially
 */
export function useImageUpload(existingImageUrl?: string | null): UseImageUploadResult {
	const [imageFile, setImageFile] = useState<File | null>(null);
	const [imagePreview, setImagePreview] = useState<string | null>(existingImageUrl || null);
	const [uploading, setUploading] = useState(false);
	const [error, setError] = useState("");

	const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) {
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
			setError("");
			return;
		}

		// Validate file
		const validation = validateImageFile(file);
		if (!validation.valid) {
			setError(validation.error || "Invalid image file");
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
			return;
		}

		// Create preview
		try {
			const preview = await createImagePreview(file);
			setImageFile(file);
			setImagePreview(preview);
			setError("");
		} catch (err) {
			setError("Failed to create image preview");
			setImageFile(null);
			setImagePreview(existingImageUrl || null);
		}
	};

	const clearImage = () => {
		setImageFile(null);
		setImagePreview(existingImageUrl || null);
		setError("");
	};

	return {
		imageFile,
		imagePreview,
		uploading,
		error,
		setImageFile,
		handleImageChange,
		clearImage,
	};
}

