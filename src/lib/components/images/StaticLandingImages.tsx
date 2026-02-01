import Link from "next/link";
import Image from "next/image";
import { PROJECT_NEW } from "@/lib/const/routes";

const LANDING_IMAGES = [
	{
		src: "/static/assets/images/PL_landing_surfaces_muted/PL_landing_surfaces_muted-1.png",
		alt: "Find",
		href: "/explore?type=event&sort=newest&view=map&tags=improv",
	},
	{
		src: "/static/assets/images/PL_landing_surfaces_muted/PL_landing_surfaces_muted-2.png",
		alt: "Discover",
		href: "/explore?sort=newest",
	},
	{
		src: "/static/assets/images/PL_landing_surfaces_muted/PL_landing_surfaces_muted-3.png",
		alt: "Build",
		href: "/explore?type=project&sort=oldest",
	},
	{
		src: "/static/assets/images/PL_landing_surfaces_muted/PL_landing_surfaces_muted-4.png",
		alt: "Contribute",
		href: PROJECT_NEW,
	},
] as const;

export const StaticLandingImages = () => {
	return (
		<div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-6 max-w-[min(100%,612px)] md:max-w-[min(100%,800px)] lg:max-w-[min(100%,1024px)] xl:max-w-[min(100%,1200px)] mx-auto px-4">
			{LANDING_IMAGES.map((image, i) => (
				<Link key={i} className="min-w-0 block" href={image.href}>
					<div className="pt-4 px-4">
						<Image
							src={image.src}
							alt={image.alt}
							width={600}
							height={600}
							className="w-full h-auto object-contain rounded shadow-glow hover:shadow-glow-lg transition-shadow cursor-pointer"
						/>
					</div>
				</Link>
			))}
		</div>
	);
};
