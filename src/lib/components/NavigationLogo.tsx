import Link from "next/link";
import Image from "next/image";

export function AnimatedProjectLibraryLogo(height: number = 120, width: number = 240, className: string = "h-[80px] w-auto") {
	return (
		<Link href="/collections" className="hover:opacity-80 transition-opacity flex items-center">
			<Image
				src="/assets/img/Project_Library_Animated_Logo.gif"
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

