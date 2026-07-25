"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { ImageItem } from "@/lib/types/image";
import { uploadAndAttachImage } from "@/lib/utils/image-client";
import { validateImageFile, compressImage, MAX_IMAGE_SIZE } from "@/lib/utils/image";
import { API_IMAGE, API_IMAGE_ATTACHMENT } from "@/lib/const/routes";
import { ModalShell } from "@/lib/components/ui/ModalShell";
import { ModalButton } from "@/lib/components/ui/ModalButton";
import { CaptionInput } from "@/lib/components/images/CaptionInput";

type Props = {
	isOpen: boolean;
	onClose: () => void;
	postId: string;
	images: ImageItem[];
	setImages: React.Dispatch<React.SetStateAction<ImageItem[]>>;
	initialIndex?: number;
};

/**
 * Carousel-preview editor for a post's photos. Shows the whole set, lets the owner
 * caption the current photo, add more, or remove one — all committed immediately
 * (matching the avatar/cover modals). The page carousel reads the same `images`
 * state, so it reflects changes as soon as the modal closes.
 */
export function PostImagesModal({ isOpen, onClose, postId, images, setImages, initialIndex = 0 }: Props) {
	const fileRef = useRef<HTMLInputElement>(null);
	const [index, setIndex] = useState(initialIndex);
	const [caption, setCaption] = useState("");
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState("");
	// Last caption we've persisted per image id. Set synchronously before the PATCH so a
	// second saveCaption for the same photo (e.g. onBlur firing right before a Done/nav
	// click that also flushes) short-circuits instead of firing a duplicate request —
	// the `current.caption` closure is stale between those two calls, so it can't dedupe.
	const savedCaptionRef = useRef<Record<string, string | null>>({});

	const safeIndex = Math.min(index, Math.max(0, images.length - 1));
	const current = images[safeIndex];
	const currentId = current?.id;

	// Reset the caption draft only when the *shown* photo changes (nav / add / remove),
	// not when we write a caption back into the same photo.
	useEffect(() => {
		setCaption(current?.caption ?? "");
	}, [currentId]); // eslint-disable-line react-hooks/exhaustive-deps

	if (!isOpen) return null;

	async function saveCaption() {
		if (!current) return;
		const imageId = current.id;
		const next = caption.trim() || null;
		const lastSaved = savedCaptionRef.current[imageId] ?? (current.caption ?? null);
		if (next === lastSaved) return;
		savedCaptionRef.current[imageId] = next; // mark before the await so a concurrent call no-ops
		setBusy(true);
		try {
			const res = await fetch(API_IMAGE(imageId), {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ caption: next }),
			});
			if (!res.ok) throw new Error("Failed to save caption");
			const updated: ImageItem = await res.json();
			setImages((prev) => prev.map((img) => (img.id === imageId ? { ...img, caption: updated.caption } : img)));
		} catch (err) {
			savedCaptionRef.current[imageId] = lastSaved; // revert so a retry can re-attempt
			setError(err instanceof Error ? err.message : "Failed to save caption");
		} finally {
			setBusy(false);
		}
	}

	async function goTo(next: number) {
		await saveCaption();
		setIndex(next);
	}

	async function handleAddFile(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (fileRef.current) fileRef.current.value = "";
		if (!file) return;
		setError("");

		let processed = file;
		const validation = validateImageFile(file);
		if (!validation.valid) {
			if (file.size <= MAX_IMAGE_SIZE) {
				setError(validation.error || "Invalid image file");
				return;
			}
			try {
				processed = await compressImage(file);
			} catch {
				setError("Failed to compress image");
				return;
			}
		}

		setBusy(true);
		try {
			await saveCaption(); // flush any pending caption before appending
			const item = await uploadAndAttachImage({ file: processed, folder: "post-photos", type: "POST", targetId: postId, sortOrder: images.length });
			const newIndex = images.length;
			setImages((prev) => [...prev, item]);
			setIndex(newIndex);
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to add photo");
		} finally {
			setBusy(false);
		}
	}

	async function handleRemove() {
		if (!current) return;
		setBusy(true);
		setError("");
		try {
			if (current.attachmentId) {
				const res = await fetch(API_IMAGE_ATTACHMENT(current.attachmentId), { method: "DELETE" });
				if (!res.ok) throw new Error("Failed to remove photo");
			}
			setImages((prev) => prev.filter((img) => img.id !== current.id));
			setIndex((i) => Math.max(0, Math.min(i, images.length - 2)));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to remove photo");
		} finally {
			setBusy(false);
		}
	}

	async function handleClose() {
		await saveCaption();
		onClose();
	}

	return (
		<ModalShell title={images.length > 0 ? "Edit photos" : "Add photos"} onClose={handleClose} widthClassName="max-w-lg">
				{current ? (
					<>
						{/* Carousel preview with an editable caption banner */}
						<div className="relative w-full bg-gray-100 rounded-lg overflow-hidden">
							<Image
								src={current.url}
								alt={current.altText || `Photo ${safeIndex + 1}`}
								width={800}
								height={600}
								style={{ width: "100%", height: "auto", maxHeight: "20rem", objectFit: "contain" }}
								unoptimized
							/>

							{images.length > 1 && (
								<>
									<button
										onClick={() => goTo(safeIndex === 0 ? images.length - 1 : safeIndex - 1)}
										className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
										aria-label="Previous photo"
									>
										<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
										</svg>
									</button>
									<button
										onClick={() => goTo(safeIndex === images.length - 1 ? 0 : safeIndex + 1)}
										className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-1.5 transition-colors"
										aria-label="Next photo"
									>
										<svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
											<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
										</svg>
									</button>
									<div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
										{images.map((img, i) => (
											<button
												key={img.id}
												onClick={() => goTo(i)}
												className={`h-1.5 rounded-full transition-all ${i === safeIndex ? "w-6 bg-white" : "w-1.5 bg-white/50 hover:bg-white/75"}`}
												aria-label={`Go to photo ${i + 1}`}
											/>
										))}
									</div>
								</>
							)}
						</div>

						<CaptionInput
							value={caption}
							onChange={(e) => setCaption(e.target.value)}
							onBlur={saveCaption}
							className="mt-3"
						/>
					</>
				) : (
					<div className="w-full h-40 rounded-lg bg-soft-grey flex items-center justify-center text-warm-grey">
						No photos yet
					</div>
				)}

				{error && <p className="text-red-500 text-sm mt-3 text-center">{error}</p>}

				<input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAddFile} />
				<div className="flex flex-col gap-2 mt-4">
					<ModalButton variant="primary" onClick={() => fileRef.current?.click()} disabled={busy}>
						{busy ? "Working…" : "Add photo"}
					</ModalButton>
					{current && (
						<ModalButton variant="outline" onClick={handleRemove} disabled={busy}>
							Remove photo
						</ModalButton>
					)}
					<ModalButton variant="dark" onClick={handleClose} disabled={busy}>
						Done
					</ModalButton>
				</div>
		</ModalShell>
	);
}
