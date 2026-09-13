import Link from "next/link";

type EventMapProps = {
	latitude: number;
	longitude: number;
	title?: string;
	/** Tailwind height class for the map iframe (default `h-64`). */
	heightClassName?: string;
	/** Tailwind width/max-width class for the map container (default full width). */
	widthClassName?: string;
};

/** Basic OpenStreetMap iframe map centered on a single event marker. */
export function EventMap({
	latitude,
	longitude,
	title,
	heightClassName = "h-64",
	widthClassName = "w-full max-w-full",
}: EventMapProps) {
	const delta = 0.02; // ~2km radius
	const south = latitude - delta;
	const north = latitude + delta;
	const west = longitude - delta;
	const east = longitude + delta;
	const bbox = `${west}%2C${south}%2C${east}%2C${north}`;
	const marker = `${latitude}%2C${longitude}`;
	const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
	const viewLink = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=16/${latitude}/${longitude}`;

	return (
		<div className={`${widthClassName} rounded border border-gray-200 bg-white/90 shadow-sm`}>
			<iframe
				src={mapSrc}
				title={title ? `Map for ${title}` : "Event location map"}
				className={`w-full ${heightClassName} border-0`}
				loading="lazy"
				referrerPolicy="no-referrer"
				aria-label="Event location map"
			/>
			<div className="flex flex-col gap-1 p-2 text-xs text-gray-600 sm:flex-row sm:items-center sm:justify-between">
				<p>Map powered by OpenStreetMap.</p>
				<Link
					href={viewLink}
					target="_blank"
					rel="noreferrer"
					className="text-blue-600 underline underline-offset-2"
				>
					Open in OpenStreetMap
				</Link>
			</div>
		</div>
	);
}

