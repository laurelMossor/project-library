import { Session } from "next-auth";
import { AnimatedProjectLibraryLogo } from "./AnimatedProjectLibraryLogo";
import { HamburgerMenu } from "./HamburgerMenu";

interface NavigationBarProps {
	session: Session | null;
}

export function NavigationBar({ session }: NavigationBarProps) {
	return (
		<header className="h-[110px] w-full border-b border-rich-brown px-6">
			<div className="flex items-center justify-between gap-4 p-1">

				<AnimatedProjectLibraryLogo />
				<HamburgerMenu session={session} />
			</div>
			<div className="text-rich-brown text-xs italic">Inspiring off-screen action and in-person connection</div>
		</header>
	);
}

