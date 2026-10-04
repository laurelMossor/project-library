import { Suspense } from "react";
import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { getActingIdentity } from "@/lib/utils/server/session";
import { NavigationBar } from "@/lib/components/nav-bar/NavigationBar";
import { SetupHeader } from "@/lib/components/nav-bar/SetupHeader";
import { SetupGate } from "@/lib/components/setup/SetupGate";
import { Footer } from "@/lib/components/footer/Footer";
import { Analytics } from "@vercel/analytics/next";

export const metadata: Metadata = {
	title: "Project Library",
	description: "A platform for sharing and discovering projects",
	icons: {
		icon: [
			{ url: "/favicon.png", type: "image/png" },
			{ url: "/icon.png", type: "image/png" },
		],
	},
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	// Resolve the acting identity server-side so the nav derives its profile tag from
	// props. router.refresh() (called after avatar/profile edits) re-runs this and flows
	// the fresh identity down — the single sync path, replacing a stale client cache.
	const { currentUser, activePage } = await getActingIdentity(session);

	return (
		<html lang="en">
			<body className="bg-grey-white text-rich-brown">
				<Providers session={session} currentUser={currentUser} activePage={activePage}>
					<Suspense fallback={null}>
						<SetupGate needsSetup={!!session?.user?.needsSetup} />
					</Suspense>
					<div className="flex flex-col min-h-screen">
						{/* Navigation bar. An account still in setup sees only the logo. */}
						{session?.user?.needsSetup ? <SetupHeader /> : <NavigationBar session={session} />}

						{/* Main content area - no sidebar */}
						<main className="flex-1">
							{children}
						</main>
						<Footer />
					</div>
				</Providers>
			<Analytics />
			</body>
		</html>
	);
}
