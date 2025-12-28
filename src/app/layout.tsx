import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { NavigationBar } from "@/lib/components/NavigationBar";

export const metadata: Metadata = {
	title: "Project Library",
	description: "A platform for sharing and discovering projects",
};

export default async function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const session = await auth();
	
	// Get user home link if logged in
	let userHomeLink: string | undefined;
	if (session?.user?.id) {
		const user = await getUserById(session.user.id);
		if (user) {
			userHomeLink = `/u/${user.username}`;
		}
	}

	return (
		<html lang="en">
			<body className="bg-grey-white text-rich-brown">
				<Providers>
					<div className="flex flex-col min-h-screen">
						{/* Navigation bar */}
						<NavigationBar userHomeLink={userHomeLink} />

						{/* Main content area - no sidebar */}
						<main className="flex-1">
							{children}
						</main>
					</div>
				</Providers>
			</body>
		</html>
	);
}

