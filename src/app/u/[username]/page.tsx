import { getUserByUsername } from "@/lib/utils/user";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";

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

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-md">
				<h1 className="text-3xl font-bold">{user.name || user.username}</h1>
				{user.headline && <p className="text-lg text-gray-600 mt-1">{user.headline}</p>}
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
								<span
									key={interest}
									className="px-2 py-1 bg-gray-100 rounded text-sm"
								>
									{interest}
								</span>
							))}
						</div>
					</div>
				)}

				<div className="mt-8 flex gap-4">
					{session && !isOwnProfile && (
						<Link
							href={`/messages/${user.id}`}
							className="px-4 py-2 bg-black text-white rounded hover:bg-gray-800 transition-colors"
						>
							Send Message
						</Link>
					)}
					<Link href="/" className="inline-block underline">
						Back to home
					</Link>
				</div>
			</div>
		</main>
	);
}
