"use client";

import Avatar from "boring-avatars";

// Hex mirrors of the PL tokens in src/app/globals.css. SVG fill attributes can't read CSS vars.
// boring-avatars calls useId and ships no "use client", so this file is the client boundary.
const AVATAR_COLORS = ["#475841", "#C4D6B0", "#A3333D", "#477998", "#D496A7"];

export function GeneratedAvatar({ seed }: { seed: string }) {
	return (
		<Avatar
			name={seed}
			variant="bauhaus"
			colors={AVATAR_COLORS}
			size="100%"
			title={false}
			className="h-full w-full"
		/>
	);
}
