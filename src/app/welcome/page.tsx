import Image from "next/image";

const LANDING_IMAGES_BASE = "/static/assets/images/PL_landing_surfaces_1";
const LANDING_IMAGES = [
	`${LANDING_IMAGES_BASE}/PL_landing_surfaces-1.png`,
	`${LANDING_IMAGES_BASE}/PL_landing_surfaces-2.png`,
	`${LANDING_IMAGES_BASE}/PL_landing_surfaces-3.png`,
	`${LANDING_IMAGES_BASE}/PL_landing_surfaces-4.png`,
];

export default function WelcomePage() {
	return (
		<div className="pt-4 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 lg:gap-6 max-w-[min(100%,612px)] md:max-w-[min(100%,800px)] lg:max-w-[min(100%,1024px)] xl:max-w-[min(100%,1200px)] mx-auto px-4">
			{LANDING_IMAGES.map((src, i) => (
				<div key={i} className="min-w-0">
                    <div className="pt-4 px-4">					
                        <Image
                            src={src}
                            alt={`Project Library landing surface ${i + 1}`}
                            width={600}
                            height={600}
                            className="w-full h-auto object-contain rounded shadow-[0_0_15px_rgba(0,0,0,0.12)] hover:shadow-[0_0_28px_rgba(0,0,0,0.22)] transition-shadow"
					    />
                    </div>

				</div>
			))}
		</div>
	);
}