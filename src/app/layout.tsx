import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./providers";
import { auth } from "@/lib/auth";
import Link from "next/link";

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

	return (
		<html lang="en">
			<body className="bg-grey-white text-rich-brown">
				<Providers>
					<div className="flex flex-col min-h-screen">
						{/* Top bar - fixed height 100px, full width */}
						<header className="h-[100px] w-full border-b border-rich-brown flex items-center justify-between px-6">
							<h1 className="text-2xl font-bold">Project Library</h1>
							{session ? (
								<div className="flex items-center gap-4">
									<span className="text-sm text-gray-600">
										{session.user?.email}
									</span>
									<Link
										href="/api/auth/signout"
										className="text-sm underline"
									>
										Log out
									</Link>
								</div>
							) : (
								<div className="flex items-center gap-4">
									<Link href="/login" className="text-sm underline">
										Log In
									</Link>
									<Link href="/signup" className="text-sm underline">
										Sign Up
									</Link>
								</div>
							)}
						</header>

						{/* Main content area with sidebar and main content */}
						<div className="flex flex-1">
							{/* Sidebar - fixed width 150px */}
							<aside className="w-[150px] border-r border-rich-brown flex flex-col p-4">
								<nav className="flex flex-col gap-4">
									<Link href="/" className="underline">
										Home
									</Link>
									<Link href="/projects" className="underline">
										Projects
									</Link>
									{session && (
										<>
											<Link href="/profile" className="underline">
												Profile
											</Link>
											<Link href="/messages" className="underline">
												Messages
											</Link>
										</>
									)}
								</nav>
							</aside>

							{/* Main content area - takes remaining space */}
							<main className="flex-1">
								{children}
							</main>
						</div>
					</div>
				</Providers>
			</body>
		</html>
	);
}

