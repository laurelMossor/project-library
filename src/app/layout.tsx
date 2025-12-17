import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Project Library",
	description: "A platform for sharing and discovering projects",
};

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body>{children}</body>
		</html>
	);
}

