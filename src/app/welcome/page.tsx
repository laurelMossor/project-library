"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const IMAGE_VERSIONS = ["A", "B", "C", "D"] as const;
const PAUSE_DURATIONS = [5, 7, 9] as const;
const IMAGE_NAMES = ["FIND", "DISCOVER", "BUILD", "CONTRIBUTE"] as const;

const getRandomElement = <T,>(array: readonly T[]): T => {
	return array[Math.floor(Math.random() * array.length)];
};

const getImagePath = (name: string, version: string): string => {
	return `/static/assets/images/PL_landing_surfaces_${version}/${name}_${version}.png`;
};

interface RotatingImageProps {
	imageName: string;
	altText: string;
}

function RotatingImage({ imageName, altText }: RotatingImageProps) {
	const [currentSrc, setCurrentSrc] = useState<string>(
		getImagePath(imageName, "A")
	);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	useEffect(() => {
		const scheduleNextRotation = () => {
			// Get random pause duration (2, 3, or 4 seconds)
			const nextPause = getRandomElement(PAUSE_DURATIONS);
			
			// Get random version (A, B, C, or D)
			const nextVersion = getRandomElement(IMAGE_VERSIONS);
			
			// Update the image source after the pause duration
			timeoutRef.current = setTimeout(() => {
				setCurrentSrc(getImagePath(imageName, nextVersion));
				// Schedule the next rotation
				scheduleNextRotation();
			}, nextPause * 1000);
		};

		// Start the rotation cycle
		scheduleNextRotation();

		// Cleanup function
		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [imageName]);

	return (
		<div className="min-w-0">
			<div className="pt-4 px-4">
				<Image
					src={currentSrc}
					alt={altText}
					width={600}
					height={600}
					className="w-full h-auto object-contain rounded shadow-glow hover:shadow-glow-lg transition-shadow"
				/>
			</div>
		</div>
	);
}

export default function WelcomePage() {
	return (
		<div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-6 max-w-[min(100%,612px)] md:max-w-[min(100%,800px)] lg:max-w-[min(100%,1024px)] xl:max-w-[min(100%,1200px)] mx-auto px-4">
			{IMAGE_NAMES.map((name, i) => (
				<RotatingImage
					key={name}
					imageName={name}
					altText={`Project Library landing surface ${i + 1}`}
				/>
			))}
		</div>
	);
}