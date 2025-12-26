import { auth } from "@/lib/auth";
import Link from "next/link";

export default async function Home() {
	const session = await auth();

	return (
		<div className="p-8">
			<h1 className="text-4xl font-bold mb-6">Welcome!</h1>

			{session ? (
				<div className="space-y-4">
					<p className="text-lg">
						Logged in as <span className="font-medium">{session.user?.email}</span>
					</p>
					<div className="flex flex-wrap gap-4">
						<Link href="/collections" className="underline">View Collections</Link>
						<Link href="/projects/new" className="underline">New Project</Link>
						<Link href="/events/new" className="underline">Create Event</Link>
					</div>
				</div>
			) : (
				<div className="space-y-4">
					<p className="text-lg">
						Get started by creating an account or logging in.
					</p>
					<Link href="/collections" className="inline-block underline">Browse Collections</Link>
				</div>
			)}
		</div>
	);
}
