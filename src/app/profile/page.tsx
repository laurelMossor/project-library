import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/utils/server/user";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getProjectsByUser } from "@/lib/utils/server/project";
import { getEventsByUser } from "@/lib/utils/server/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";
import { EditableProfile } from "@/lib/components/user/EditableProfile";

export default async function ProfilePage() {
	// Middleware protects this route, but we verify session here as a safety check
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/login?callbackUrl=/profile");
	}

	const userId = session.user.id;
	const user = await getUserById(userId);

	if (!user) {
		redirect("/login?callbackUrl=/profile");
	}

	// Fetch user's projects and events
	const [projects, events] = await Promise.all([
		getProjectsByUser(userId),
		getEventsByUser(userId),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-6xl">
				<div className="max-w-md mx-auto">
					<h1 className="text-2xl font-bold mb-6">Your Profile</h1>
					<EditableProfile user={user} />
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
