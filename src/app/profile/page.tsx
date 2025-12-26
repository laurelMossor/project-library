import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjectsByUser } from "@/lib/utils/project";
import { getEventsByUser } from "@/lib/utils/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";

export default async function ProfilePage() {
	// Proxy protects this route, but we verify session here as a safety check
	// If session is invalid, redirect to login (proxy handles cookie-based protection)
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/login?callbackUrl=/profile");
	}

	const user = await getUserById(session.user.id);

	if (!user) {
		redirect("/login?callbackUrl=/profile");
	}

	// Fetch user's projects and events
	const [projects, events] = await Promise.all([
		getProjectsByUser(session.user.id),
		getEventsByUser(session.user.id),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-6xl">
				<div className="max-w-md mx-auto">
					<div className="flex justify-between items-center">
						<h1 className="text-2xl font-bold">Your Profile</h1>
						<Link href="/profile/edit" className="text-sm underline">Edit</Link>
					</div>

					<div className="mt-6 space-y-4">
						<div>
							<span className="text-sm text-gray-500">Name:</span>
							<p>{user.name || "Not set"}</p>
						</div>
						<div>
							<span className="text-sm text-gray-500">Username:</span>
							<p>@{user.username}</p>
						</div>
						<div>
							<span className="text-sm text-gray-500">Headline:</span>
							<p>{user.headline || "Not set"}</p>
						</div>
						<div>
							<span className="text-sm text-gray-500">Bio:</span>
							<p>{user.bio || "Not set"}</p>
						</div>
						<div>
							<span className="text-sm text-gray-500">Interests:</span>
							<p>{user.interests?.length ? user.interests.join(", ") : "Not set"}</p>
						</div>
						<div>
							<span className="text-sm text-gray-500">Location:</span>
							<p>{user.location || "Not set"}</p>
						</div>
					</div>

					<div className="mt-6 flex gap-4">
						<Link href={`/u/${user.username}`} className="underline">View public profile</Link>
						<Link href="/" className="underline">Home</Link>
					</div>
				</div>

				{/* User's Collection Section */}
				<UserCollectionSection items={collectionItems} />
			</div>
		</main>
	);
}
