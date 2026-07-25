"use client";

import { useRef, useState } from "react";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { ModalButton } from "@/lib/components/ui/ModalButton";
import { CaptionInput } from "@/lib/components/images/CaptionInput";

type ImageEditModalProps = {
	isOpen: boolean;
	onClose: () => void;
	title: string;
	previewShape: "round" | "rect";
	existingImageUrl: string | null;
	/** Present (even as null) enables the caption field. Omit for no-caption surfaces (avatar, event cover). */
	existingCaption?: string | null;
	showCaption?: boolean;
	/** Rendered in the preview area when there's no image (e.g. avatar initials). */
	fallback?: React.ReactNode;
	saveLabel?: string;
	/**
	 * Persistence is the caller's job. `file` is null when only the caption changed.
	 * `caption` is only meaningful when `showCaption` is set.
	 */
	onSave: (args: { file: File | null; caption?: string | null }) => Promise<void>;
	/** Omit to hide the remove button (e.g. event cover is change-only). */
	onRemove?: () => Promise<void>;
};

/**
 * Single-image editor: pick a file, preview it, optionally caption it, Save/Remove.
 * The caller owns where the image goes (avatar FK vs. ImageAttachment) via onSave/onRemove.
 * Used by avatars (round, no caption) and event covers (rect, no caption). For a post's
 * multi-photo set see PostImagesModal.
 */
export function ImageEditModal({
	isOpen,
	onClose,
	title,
	previewShape,
	existingImageUrl,
	existingCaption,
	showCaption = false,
	fallback,
	saveLabel = "Save",
	onSave,
	onRemove,
}: ImageEditModalProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");
	const [caption, setCaption] = useState(existingCaption ?? "");

	const { imageFile, imagePreview, error: uploadError, wasCompressed, handleImageChange, clearImage } =
		useImageUpload(existingImageUrl);

	if (!isOpen) return null;

	const previewUrl = imagePreview ?? existingImageUrl;
	const captionDirty = showCaption && caption !== (existingCaption ?? "");
	const canSave = Boolean(imageFile) || captionDirty;

	async function handleSave() {
		setSaving(true);
		setError("");
		try {
			await onSave({ file: imageFile ?? null, caption: showCaption ? caption.trim() || null : undefined });
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	}

	async function handleRemove() {
		if (!onRemove) return;
		setSaving(true);
		setError("");
		try {
			await onRemove();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	}

	return (
		<ModalShell title={title} onClose={onClose} widthClassName="max-w-sm">
			{/* Preview */}
			<div className="flex justify-center mb-6">
				{previewShape === "round" ? (
					previewUrl ? (
						<img src={previewUrl} alt="Preview" className="w-32 h-32 rounded-full object-cover ring-4 ring-rich-brown" />
					) : (
						<div className="w-32 h-32 rounded-full bg-soft-grey flex items-center justify-center text-3xl font-medium text-gray-600 ring-4 ring-rich-brown">
							{fallback}
						</div>
					)
				) : previewUrl ? (
					<img src={previewUrl} alt="Preview" className="w-full max-h-64 rounded-lg object-contain bg-gray-100" />
				) : (
					<div className="w-full h-40 rounded-lg bg-soft-grey flex items-center justify-center text-warm-grey">
						{fallback ?? "No photo yet"}
					</div>
				)}
			</div>

			{showCaption && (
				<CaptionInput value={caption} onChange={(e) => setCaption(e.target.value)} className="mb-4" />
			)}

			{(error || uploadError) && (
				<p className="text-red-500 text-sm mb-4 text-center">{error || uploadError}</p>
			)}
			{wasCompressed && !error && !uploadError && (
				<p className="text-xs text-amber-600 mb-4 text-center">
					Image was automatically resized to fit the 5MB limit
				</p>
			)}

			<div className="flex flex-col gap-3">
				<input
					ref={fileInputRef}
					type="file"
					accept="image/jpeg,image/png,image/webp"
					className="hidden"
					onChange={handleImageChange}
				/>
				<ModalButton variant="primary" onClick={() => fileInputRef.current?.click()} disabled={saving}>
					{previewUrl ? "Change photo" : "Upload photo"}
				</ModalButton>

				{canSave && (
					<ModalButton variant="dark" onClick={handleSave} disabled={saving}>
						{saving ? "Saving…" : saveLabel}
					</ModalButton>
				)}

				{onRemove && existingImageUrl && !imageFile && (
					<ModalButton variant="outline" onClick={handleRemove} disabled={saving}>
						{saving ? "Removing…" : "Remove photo"}
					</ModalButton>
				)}

				{imageFile && (
					<button
						onClick={() => clearImage()}
						disabled={saving}
						className="text-sm text-dusty-grey hover:text-warm-grey text-center"
					>
						Cancel selection
					</button>
				)}
			</div>
		</ModalShell>
	);
}
