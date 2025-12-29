import { AnimatedProjectLibraryLogo } from "./AnimatedProjectLibraryLogo";
import { NavigationIcons } from "./NavigationIcons";

interface NavigationBarProps {
	userHomeLink?: string; // Pass the user home link from server component
}

export function NavigationBar({ userHomeLink }: NavigationBarProps) {
	return (
		<header className="h-[100px] w-full border-b border-rich-brown flex items-center justify-between px-6">
			<AnimatedProjectLibraryLogo />
			<NavigationIcons userHomeLink={userHomeLink} />
		</header>
	);
}

