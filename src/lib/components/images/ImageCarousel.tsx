'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ImageItem } from '@/lib/types/image';

const ImageCarousel = ({ images }: { images: ImageItem[] }) => {
	const [currentIndex, setCurrentIndex] = useState(0);

	if (!images || images.length === 0) {
		return null;
	}

	const goToPrevious = () => {
		setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
	};

	const goToNext = () => {
		setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
	};

	const goToSlide = (index: number) => {
		setCurrentIndex(index);
	};

	return (
		<div className="relative w-full">
			{/* Main image container */}
			<div className="relative w-full h-[500px] bg-gray-100">
				<Image
					src={images[currentIndex].url}
					alt={images[currentIndex].altText || `Image ${currentIndex + 1}`}
					fill
					style={{ objectFit: 'contain' }}
					unoptimized
				/>
			</div>

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

					{/* Dot indicators */}
					<div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2">
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
	);
};

export default ImageCarousel;