'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageItem } from '@/lib/types/image';

type Props = {
	images: ImageItem[];
	showCaptions?: boolean;
	isOwner?: boolean;
};

const ImageCarousel = ({ images: initialImages, showCaptions = false, isOwner = false }: Props) => {
	const [images, setImages] = useState(initialImages);
	const [currentIndex, setCurrentIndex] = useState(0);
	const [editingCaption, setEditingCaption] = useState(false);
	const [captionDraft, setCaptionDraft] = useState('');
	const [saving, setSaving] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	if (!images || images.length === 0) {
		return null;
	}

	const goToPrevious = () => {
		setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
		setEditingCaption(false);
		setConfirmDelete(false);
	};

	const goToNext = () => {
		setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
		setEditingCaption(false);
		setConfirmDelete(false);
	};

	const goToSlide = (index: number) => {
		setCurrentIndex(index);
		setEditingCaption(false);
		setConfirmDelete(false);
	};

	const deleteCurrentImage = async () => {
		const image = images[currentIndex];
		if (!image.attachmentId) return;
		setSaving(true);
		try {
			const res = await fetch(`/api/image-attachments/${image.attachmentId}`, { method: 'DELETE' });
			if (res.ok) {
				const next = images.filter((_, i) => i !== currentIndex);
				setImages(next);
				setCurrentIndex(Math.min(currentIndex, next.length - 1));
				setConfirmDelete(false);
			}
		} finally {
			setSaving(false);
		}
	};

	const startEdit = () => {
		setCaptionDraft(currentImage.caption ?? '');
		setEditingCaption(true);
	};

	const cancelEdit = () => {
		setEditingCaption(false);
		setCaptionDraft('');
	};

	const saveCaption = async () => {
		setSaving(true);
		try {
			const res = await fetch(`/api/images/${currentImage.id}`, {
				method: 'PATCH',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ caption: captionDraft || null }),
			});
			if (res.ok) {
				const updated: ImageItem = await res.json();
				setImages((prev) => prev.map((img) => (img.id === updated.id ? { ...img, caption: updated.caption } : img)));
			}
		} finally {
			setSaving(false);
			setEditingCaption(false);
		}
	};

	const currentImage = images[currentIndex];
	const showCaption = showCaptions && Boolean(currentImage.caption);

	return (
		<div className="w-full">
			<div className="relative w-full">
				{/* Main image container */}
				<div className="relative w-full bg-gray-100">
					<Image
						src={currentImage.url}
						alt={currentImage.altText || `Image ${currentIndex + 1}`}
						width={800}
						height={600}
						style={{ width: '100%', height: 'auto', objectFit: 'contain' }}
						unoptimized
					/>
				</div>

				{/* Caption banner — semi-transparent overlay at bottom, detail pages only */}
				{showCaption && (
					<div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm px-3 py-2">
						{currentImage.caption}
					</div>
				)}

				{/* Navigation buttons */}
				{images.length > 1 && (
					<>
						{/* Previous button */}
						<button
							onClick={goToPrevious}
							className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
							aria-label="Previous image"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
							</svg>
						</button>

						{/* Next button */}
						<button
							onClick={goToNext}
							className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white rounded-full p-2 transition-colors"
							aria-label="Next image"
						>
							<svg
								xmlns="http://www.w3.org/2000/svg"
								className="h-6 w-6"
								fill="none"
								viewBox="0 0 24 24"
								stroke="currentColor"
							>
								<path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
							</svg>
						</button>

						{/* Dot indicators — raised above caption when visible */}
						<div className={`absolute ${showCaption ? 'bottom-10' : 'bottom-4'} left-1/2 -translate-x-1/2 flex gap-2`}>
							{images.map((_, index) => (
								<button
									key={index}
									onClick={() => goToSlide(index)}
									className={`h-2 rounded-full transition-all ${
										index === currentIndex ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'
									}`}
									aria-label={`Go to image ${index + 1}`}
								/>
							))}
						</div>
					</>
				)}
			</div>

			{/* Caption + delete controls — below the image, owners only */}
			{showCaptions && isOwner && (
				<div className="mt-2">
					{editingCaption ? (
						<div className="flex flex-col gap-2">
							<input
								type="text"
								value={captionDraft}
								onChange={(e) => setCaptionDraft(e.target.value)}
								placeholder="Add a caption…"
								maxLength={500}
								autoFocus
								className="w-full text-sm border border-ash-green rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							/>
							<div className="flex gap-2">
								<button
									onClick={saveCaption}
									disabled={saving}
									className="text-xs px-3 py-1 rounded bg-rich-brown text-white hover:bg-rich-brown/90 disabled:opacity-50 transition-colors"
								>
									{saving ? 'Saving…' : 'Save'}
								</button>
								<button
									onClick={cancelEdit}
									className="text-xs px-3 py-1 rounded border border-soft-grey/60 text-dusty-grey hover:text-rich-brown transition-colors"
								>
									Cancel
								</button>
							</div>
						</div>
					) : confirmDelete ? (
						<div className="flex items-center gap-2">
							<span className="text-xs text-warm-grey">Remove this image?</span>
							<button
								onClick={deleteCurrentImage}
								disabled={saving}
								className="text-xs px-3 py-1 rounded bg-alert-red text-white hover:bg-alert-red/90 disabled:opacity-50 transition-colors"
							>
								{saving ? 'Removing…' : 'Remove'}
							</button>
							<button
								onClick={() => setConfirmDelete(false)}
								className="text-xs text-dusty-grey hover:text-warm-grey transition-colors"
							>
								Cancel
							</button>
						</div>
					) : (
						<div className="flex items-center gap-3">
							<button
								onClick={startEdit}
								className="text-xs text-dusty-grey hover:text-moss-green transition-colors"
							>
								{currentImage.caption ? 'Edit caption' : '+ Add caption'}
							</button>
							{currentImage.attachmentId && (
								<button
									onClick={() => setConfirmDelete(true)}
									className="text-xs text-dusty-grey hover:text-alert-red transition-colors"
								>
									Remove image
								</button>
							)}
						</div>
					)}
				</div>
			)}
		</div>
	);
};

export default ImageCarousel;
