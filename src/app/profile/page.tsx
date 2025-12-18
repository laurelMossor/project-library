import { auth } from "@/lib/auth";
import { getUserById } from "@/lib/user";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function ProfilePage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/login");
	}

	const user = await getUserById(session.user.id);

	if (!user) {
		redirect("/login");
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-8">
			<div className="w-full max-w-md">
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
		</main>
	);
}
