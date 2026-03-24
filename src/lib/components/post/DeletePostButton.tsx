"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authFetch, AuthError } from "@/lib/utils/auth-client";
import { API_POST, EXPLORE_PAGE, LOGIN_WITH_CALLBACK, POST_DETAIL } from "@/lib/const/routes";

type Props = {
	postId: string;
	postTitle: string;
};

export function DeletePostButton({ postId, postTitle }: Props) {
	const router = useRouter();
	const [isDeleting, setIsDeleting] = useState(false);
	const [showConfirm, setShowConfirm] = useState(false);
	const [error, setError] = useState("");

	const handleDelete = async () => {
		setIsDeleting(true);
		setError("");

		try {
			const res = await authFetch(API_POST(postId), { method: "DELETE" });
			if (!res.ok) {
				const data = await res.json().catch(() => ({}));
				throw new Error(data.error || "Failed to delete post");
			}
			router.push(EXPLORE_PAGE);
		} catch (err) {
			if (err instanceof AuthError) {
				router.push(LOGIN_WITH_CALLBACK(POST_DETAIL(postId)));
				return;
			}
			setError(err instanceof Error ? err.message : "Failed to delete post");
			setIsDeleting(false);
			setShowConfirm(false);
		}
	};

	if (showConfirm) {
		return (
			<div className="flex flex-col gap-2">
				<p className="text-sm text-gray-700">Are you sure you want to delete &apos;{postTitle}&apos;?</p>
				{error && <p className="text-sm text-red-600">{error}</p>}
				<div className="flex gap-2">
					<button
						onClick={handleDelete}
						disabled={isDeleting}
						className="rounded border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:opacity-50"
					>
						{isDeleting ? "Deleting..." : "Delete"}
					</button>
					<button
						onClick={() => {
							setShowConfirm(false);
							setError("");
						}}
						disabled={isDeleting}
						className="rounded border border-gray-400 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-black hover:text-black disabled:opacity-50"
					>
						Cancel
					</button>
				</div>
			</div>
		);
	}

	return (
		<button
			onClick={() => setShowConfirm(true)}
			className="rounded border border-red-600 px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
		>
			Delete Post
		</button>
	);
}
