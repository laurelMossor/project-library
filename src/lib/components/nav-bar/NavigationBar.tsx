import { AnimatedProjectLibraryLogo } from "./AnimatedProjectLibraryLogo";
import { NavigationIcons } from "./NavigationIcons";

interface NavigationBarProps {
	userHomeLink?: string; // Pass the user home link from server component
}

export function NavigationBar({ userHomeLink }: NavigationBarProps) {
	return (
		<header className="h-[110px] w-full border-b border-rich-brown px-6">
			<div className="flex items-center justify-between gap-4 p-1">

				<AnimatedProjectLibraryLogo />
				<NavigationIcons userHomeLink={userHomeLink} />
			</div>
			<div className="text-rich-brown text-xs italic">Inspiring off-screen action and in-person connection</div>
		</header>
	);
}

