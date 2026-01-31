"use client";

import { PROJECT_NEW } from "@/lib/const/routes";

import { useSession } from "next-auth/react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

const IMAGE_VERSIONS = ["A", "B", "C", "D"] as const;
const PAUSE_DURATIONS = [5, 7, 9] as const;
const IMAGE_NAMES = ["FIND", "DISCOVER", "BUILD", "CONTRIBUTE"] as const;

// Placeholder paths - customize these to your desired destinations
// Supports any route, with optional query params for pre-filtered explore views
// Examples:
//   "/explore?type=project&sort=newest" - projects, newest first
//   "/explore?type=event&view=map" - events in map view
//   "/explore?tags=woodworking,crafts" - filtered by tags
//   "/about" - any other page

const IMAGE_PATHS: Record<typeof IMAGE_NAMES[number], string> = {
	FIND: "/explore?type=event&sort=newest&view=map&tags=improv",
	DISCOVER: "/explore?sort=newest",
	BUILD: "/explore?type=project&sort=oldest",
	CONTRIBUTE: PROJECT_NEW,
};

const getRandomElement = <T,>(array: readonly T[]): T => {
	return array[Math.floor(Math.random() * array.length)];
};

const getImagePath = (name: string, version: string): string => {
	return `/static/assets/images/PL_landing_surfaces_${version}/${name}_${version}.png`;
};

interface RotatingImageProps {
	imageName: typeof IMAGE_NAMES[number];
	altText: string;
	href: string;
}

function RotatingImage({ imageName, altText, href }: RotatingImageProps) {
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
		<Link className="min-w-0 block" href={href}>
			<div className="pt-4 px-4">
				<Image
					src={currentSrc}
					alt={altText}
					width={600}
					height={600}
					className="w-full h-auto object-contain rounded shadow-glow hover:shadow-glow-lg transition-shadow cursor-pointer"
				/>
			</div>
		</Link>
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
					href={IMAGE_PATHS[name]}
				/>
			))}
		</div>
	);
}