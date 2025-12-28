import { getUserByUsername } from "@/lib/utils/server/user";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Tag } from "@/lib/components/tag";
import { getProjectsByUser } from "@/lib/utils/server/project";
import { getEventsByUser } from "@/lib/utils/server/event";
import { UserCollectionSection } from "@/lib/components/collection/UserCollectionSection";

type Props = {
	params: Promise<{ username: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
	const { username } = await params;
	const user = await getUserByUsername(username);
	const session = await auth();

	if (!user) {
		notFound();
	}

	// Check if viewing own profile (only show message button if viewing another user's profile)
	const isOwnProfile = session?.user?.id === user.id;

	// Fetch user's projects and events
	const [projects, events] = await Promise.all([
		getProjectsByUser(user.id),
		getEventsByUser(user.id),
	]);

	// Combine into collection items
	const collectionItems = [...projects, ...events];

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-6xl">
				{/* Profile Header Section - Side by Side Layout */}
				<div className="flex flex-col md:flex-row gap-8 mb-8">
					{/* Left: Profile Fields */}
					<div className="flex-1">
						<h1 className="text-3xl font-bold">{user.name || user.username}</h1>
						{user.headline && <p className="text-lg mt-1">{user.headline}</p>}
						{user.location && <p className="text-sm text-gray-500 mt-1">{user.location}</p>}

						{user.bio && (
							<div className="mt-6">
								<h2 className="text-sm font-medium text-gray-500">About</h2>
								<p className="mt-1">{user.bio}</p>
							</div>
						)}

						{user.interests && user.interests.length > 0 && (
							<div className="mt-6">
								<h2 className="text-sm font-medium text-gray-500">Interests</h2>
								<div className="mt-2 flex flex-wrap gap-2">
									{user.interests.map((interest) => (
										<Tag key={interest} tag={interest} />
									))}
								</div>
							</div>
						)}
					</div>

					{/* Right: Action Buttons */}
					<div className="flex flex-col gap-3">
						{isOwnProfile ? (
							<>
								<Link
									href="/projects/new"
									className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-center"
								>
									New Project
								</Link>
								<Link
									href="/events/new"
									className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-center"
								>
									New Event
								</Link>
							</>
						) : (
							session && (
								<Link
									href={`/messages/${user.id}`}
									className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors text-center"
								>
									Send Message
								</Link>
							)
						)}
					</div>
				</div>

				{/* User's Collection Section */}
				<UserCollectionSection 
					items={collectionItems} 
					title={`${username}'s Collection`}
					emptyMessage={`${username} hasn't created any projects or events yet.`}
					showCreateLinks={false}
				/>
			</div>
		</main>
	);
}
