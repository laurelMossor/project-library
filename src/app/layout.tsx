import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { NavigationBar } from "@/lib/components/nav-bar/NavigationBar";
import { OrgOwnerBanner } from "@/lib/components/layout/OrgOwnerBanner";
import { Footer } from "@/lib/components/footer/Footer";

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
	
	return (
		<html lang="en">
			<body className="bg-grey-white text-rich-brown">
				<Providers session={session}>
					<div className="flex flex-col min-h-screen">
						{/* Navigation bar */}
						<NavigationBar session={session} />

						{/* Org Owner Banner - shows when user is acting as org */}
						<OrgOwnerBanner />

						{/* Main content area - no sidebar */}
						<main className="flex-1">
							{children}
						</main>
						<Footer />
					</div>
				</Providers>
			</body>
		</html>
	);
}
