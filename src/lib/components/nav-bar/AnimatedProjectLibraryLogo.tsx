import Link from "next/link";
import Image from "next/image";
import { WELCOME_PAGE } from "@/lib/const/routes";

interface AnimatedProjectLibraryLogoProps {
	height?: number;
	width?: number;
	className?: string;
}

export function AnimatedProjectLibraryLogo({ height = 160, width = 350, className = "max-h-[160px] max-w-full w-auto h-auto object-contain" }: AnimatedProjectLibraryLogoProps) {

	return (
		<Link href={WELCOME_PAGE} className="hover:opacity-80 transition-opacity flex items-center min-w-0 shrink">
			<Image
				src={'/static/assets/images/Project_Library_Animated_Logo.gif'}
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

