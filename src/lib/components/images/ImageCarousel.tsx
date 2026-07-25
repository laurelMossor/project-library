'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageItem } from '@/lib/types/image';

type Props = {
	images: ImageItem[];
	/** Controlled index; falls back to internal state (e.g. read-only cards). */
	currentIndex?: number;
	onIndexChange?: (index: number) => void;
	showCaptions?: boolean;
	/** When provided, an overlay "Edit" pill fires this with the current index (owner-in-edit). */
	onEditImage?: (index: number) => void;
};

/**
 * Purely presentational image carousel: image + caption banner + nav + dots,
 * plus an optional overlay "Edit" pill. All mutation (upload/caption/remove)
 * lives in the owning page's ImageEditModal, not here.
 */
const ImageCarousel = ({ images, currentIndex: controlledIndex, onIndexChange, showCaptions = false, onEditImage }: Props) => {
	const [internalIndex, setInternalIndex] = useState(0);
	const currentIndex = controlledIndex ?? internalIndex;

	if (!images || images.length === 0) {
		return null;
	}

	// Clamp in case the parent's image list shrank (e.g. after a remove).
	const safeIndex = Math.min(currentIndex, images.length - 1);

	const setIndex = (next: number) => {
		if (onIndexChange) onIndexChange(next);
		else setInternalIndex(next);
	};

	const goToPrevious = () => setIndex(safeIndex === 0 ? images.length - 1 : safeIndex - 1);
	const goToNext = () => setIndex(safeIndex === images.length - 1 ? 0 : safeIndex + 1);

	const currentImage = images[safeIndex];
	const showCaption = showCaptions && Boolean(currentImage.caption);

	return (
		<div className="w-full">
			<div className="relative w-full">
				{/* Main image container */}
				<div className="relative w-full bg-gray-100">
					<Image
						src={currentImage.url}
						alt={currentImage.altText || `Image ${safeIndex + 1}`}
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

				{/* Edit pill — same translucent-black language as the caption banner */}
				{onEditImage && (
					<button
						onClick={() => onEditImage(safeIndex)}
						className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs font-medium px-3 py-1.5 rounded-full transition-colors"
					>
						Edit
					</button>
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
									onClick={() => setIndex(index)}
									className={`h-2 rounded-full transition-all ${
										index === safeIndex ? 'w-8 bg-white' : 'w-2 bg-white/50 hover:bg-white/75'
									}`}
									aria-label={`Go to image ${index + 1}`}
								/>
							))}
						</div>
					</>
				)}
			</div>
		</div>
	);
};

export default ImageCarousel;
