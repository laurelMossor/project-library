import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
	const session = await auth();

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-4xl font-bold">Project Library</h1>

			<div className="mt-6 flex gap-4 justify-center">
				<Link href="/projects" className="underline">Projects</Link>
			</div>

			{session ? (
				<div className="mt-6 text-center">
					<p className="text-lg text-gray-600">
						Logged in as <span className="font-medium">{session.user?.email}</span>
					</p>
					<div className="mt-4 flex gap-4 justify-center">
						<Link href="/projects/new" className="underline">New Project</Link>
						<Link href="/profile" className="underline">Profile</Link>
						<Link href="/api/auth/signout" className="underline">Log out</Link>
					</div>
				</div>
			) : (
				<div className="mt-6 flex gap-4">
					<Link
						href="/login"
						className="px-4 py-2 bg-black text-white rounded"
					>
						Log In
					</Link>
					<Link
						href="/signup"
						className="px-4 py-2 border border-black rounded"
					>
						Sign Up
					</Link>
				</div>
			)}
		</main>
	);
}
