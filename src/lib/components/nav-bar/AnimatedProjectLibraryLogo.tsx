import Link from "next/link";
import Image from "next/image";
import { COLLECTIONS } from "@/lib/const/routes";

interface AnimatedProjectLibraryLogoProps {
	height?: number;
	width?: number;
	className?: string;
}

export function AnimatedProjectLibraryLogo({ height = 120, width = 240, className = "h-[80px] w-auto" }: AnimatedProjectLibraryLogoProps) {

	return (
		<Link href={COLLECTIONS} className="hover:opacity-80 transition-opacity flex items-center">
			<Image
				src={'/static/images/Project_Library_Animated_Logo.gif'}
				alt="Project Library"
				width={width}
				height={height}
				className={className}
				loading="eager"
				unoptimized
			/>
		</Link>
	);
}

