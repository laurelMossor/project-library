"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createDraftPost } from "@/lib/utils/post-client";
import { AuthError } from "@/lib/utils/auth-client";
import { POST_DETAIL, LOGIN_WITH_CALLBACK, POST_NEW } from "@/lib/const/routes";
import { useActiveProfile } from "@/lib/contexts/ActiveProfileContext";

/**
 * /posts/new — Creates a draft post pre-populated with the active profile,
 * then redirects to the post page for inline editing.
 */
export default function NewPostPage() {
	const router = useRouter();
	const { activePageId } = useActiveProfile();
	const [error, setError] = useState("");

	useEffect(() => {
		createDraftPost(activePageId ?? undefined)
			.then((post) => {
				router.replace(POST_DETAIL(post.id));
			})
			.catch((err) => {
				if (err instanceof AuthError) {
					router.push(LOGIN_WITH_CALLBACK(POST_NEW));
					return;
				}
				setError(err instanceof Error ? err.message : "Failed to create post");
			});
	}, [router, activePageId]);

	if (error) {
		return (
			<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
				<div className="text-center space-y-4">
					<p className="text-alert-red">{error}</p>
					<button
						type="button"
						onClick={() => router.back()}
						className="text-sm font-medium text-gray-500 underline underline-offset-2"
					>
						Go back
					</button>
				</div>
			</main>
		);
	}

	return (
		<main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
			<p className="text-gray-500">Creating your post...</p>
		</main>
	);
}
