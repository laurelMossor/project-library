"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useImageUpload } from "@/lib/hooks/useImageUpload";

type AvatarEditModalProps = {
	isOpen: boolean;
	onClose: () => void;
	currentAvatarUrl: string | null;
	initials: string;
};

export function AvatarEditModal({ isOpen, onClose, currentAvatarUrl, initials }: AvatarEditModalProps) {
	const router = useRouter();
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState("");

	const { imageFile, imagePreview, error: uploadError, handleImageChange, clearImage } = useImageUpload(currentAvatarUrl);

	if (!isOpen) return null;

	const previewUrl = imagePreview ?? currentAvatarUrl;

	async function handleSave() {
		if (!imageFile) return;
		setSaving(true);
		setError("");
		try {
			const formData = new FormData();
			formData.append("file", imageFile);
			const uploadRes = await fetch("/api/upload?folder=avatars", {
				method: "POST",
				body: formData,
			});
			if (!uploadRes.ok) {
				const data = await uploadRes.json().catch(() => ({}));
				throw new Error(data.error || "Upload failed");
			}
			const { id } = await uploadRes.json();
			const updateRes = await fetch("/api/me/user", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ avatarImageId: id }),
			});
			if (!updateRes.ok) throw new Error("Failed to save avatar");
			router.refresh();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	}

	async function handleRemove() {
		setSaving(true);
		setError("");
		try {
			const res = await fetch("/api/me/user", {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ avatarImageId: null }),
			});
			if (!res.ok) throw new Error("Failed to remove avatar");
			router.refresh();
			onClose();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Something went wrong");
		} finally {
			setSaving(false);
		}
	}

	return (
		<div
			className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
			onClick={onClose}
		>
			<div
				className="bg-grey-white rounded-lg p-8 max-w-sm w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-2xl font-bold">Profile Photo</h2>
					<button onClick={onClose} className="text-warm-grey hover:text-rich-brown" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" className="w-6 h-6" fill="currentColor">
							<path d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.5 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z" />
						</svg>
					</button>
				</div>

				{/* Avatar preview */}
				<div className="flex justify-center mb-6">
					{previewUrl ? (
						<img
							src={previewUrl}
							alt="Profile photo"
							className="w-32 h-32 rounded-full object-cover ring-4 ring-rich-brown"
						/>
					) : (
						<div className="w-32 h-32 rounded-full bg-soft-grey flex items-center justify-center text-3xl font-medium text-gray-600 ring-4 ring-rich-brown">
							{initials}
						</div>
					)}
				</div>

				{(error || uploadError) && (
					<p className="text-red-500 text-sm mb-4 text-center">{error || uploadError}</p>
				)}

				<div className="flex flex-col gap-3">
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						className="hidden"
						onChange={handleImageChange}
					/>
					<button
						onClick={() => fileInputRef.current?.click()}
						disabled={saving}
						className="w-full py-2 px-4 rounded bg-melon-green text-rich-brown font-semibold hover:shadow-glow-sm transition-shadow disabled:opacity-50"
					>
						Upload photo
					</button>

					{imageFile && (
						<button
							onClick={handleSave}
							disabled={saving}
							className="w-full py-2 px-4 rounded bg-rich-brown text-white font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					)}

					{currentAvatarUrl && !imageFile && (
						<button
							onClick={handleRemove}
							disabled={saving}
							className="w-full py-2 px-4 rounded border border-dusty-grey text-warm-grey hover:text-rich-brown transition-colors disabled:opacity-50"
						>
							{saving ? "Removing…" : "Remove photo"}
						</button>
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
			</div>
		</div>
	);
}
