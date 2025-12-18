import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";

export default async function ProfilePage() {
	const session = await auth();

	// Extra server-side check (middleware handles redirect, but this is a fallback)
	if (!session) {
		redirect("/login");
	}

	return (
		<main className="flex min-h-screen flex-col items-center justify-center p-24">
			<h1 className="text-2xl font-bold">Profile</h1>
			<p className="mt-4">Logged in as: {session.user?.email}</p>
			<a href="/" className="mt-4 underline">Back to home</a>
		</main>
	);
}

