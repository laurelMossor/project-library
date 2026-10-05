import { AnimatedProjectLibraryLogo } from "./AnimatedProjectLibraryLogo";

/**
 * The header while an account is still being set up: logo and tagline only. There is no
 * profile tag, notifications, or menu until the person has agreed to their settings.
 */
export function SetupHeader() {
	return (
		<header className="min-h-[110px] w-full border-b border-rich-brown px-6 py-2">
			<div className="flex items-center p-1">
				<AnimatedProjectLibraryLogo />
			</div>
			<div className="text-rich-brown px-3 text-sm italic">Inspiring off-screen action and in-person connection</div>
		</header>
	);
}
