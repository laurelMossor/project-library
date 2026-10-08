"use client";

import { useEffect, useState } from "react";
import { PostItem } from "@/lib/types/post";
import { CollectionType } from "@/lib/types/collection";
import { getEventPosts, getPostUpdates } from "@/lib/utils/post-client";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import Link from "next/link";
import { resolveCardIdentity } from "@/lib/types/card";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { contentIdentity } from "@/lib/utils/content-identity";
import { PUBLIC_PROFILE } from "@/lib/const/routes";

type PostsListProps = {
	collectionId: string;
	collectionType: CollectionType;
	showTitle?: boolean;
	maxPosts?: number;
};

export function PostsList({
	collectionId,
	collectionType,
	showTitle = true,
	maxPosts
}: PostsListProps) {
	const [posts, setPosts] = useState<PostItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadPosts() {
			try {
				const data = collectionType === "event"
					? await getEventPosts(collectionId)
					: await getPostUpdates(collectionId);
				setPosts(data);
			} catch {
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		}
		loadPosts();
	}, [collectionId, collectionType]);

	if (loading) {
		return <div className="text-sm text-misty-forest">Loading posts...</div>;
	}

	if (error) {
		return <div className="text-sm text-novel-red">{error}</div>;
	}

	if (posts.length === 0) {
		return null;
	}

	const displayPosts = maxPosts ? posts.slice(0, maxPosts) : posts;

	return (
		<div className="mt-6">
			{showTitle && (
				<h3 className="text-lg font-semibold mb-4">Updates</h3>
			)}
			<div className="space-y-4">
				{displayPosts.map((post) => {
					// Resolve the posting identity — a page takes precedence over the author.
					const identityItem = post.user ? contentIdentity({ user: post.user, page: post.page ?? null, asPageId: post.asPageId ?? null }) : null;
					const identity = identityItem ? resolveCardIdentity(identityItem.voice) : null;
					const placedIn = identityItem?.placedIn ?? null;

					return (
						<div key={post.id} className="border-l-2 border-soft-grey pl-4 py-2">
							{/* Attribution */}
							{identity && identityItem && (
								<div className="flex items-center gap-2 mb-2">
									<ProfilePicture entity={identityItem.voice} size="sm" />
									<div className="flex items-center gap-1">
										<Link
											href={identity.href}
											className="text-xs text-rich-brown hover:underline font-medium"
										>
											{identity.name}
										</Link>
										{placedIn && (
											<Link href={PUBLIC_PROFILE(placedIn.handle)} className="text-xs text-dusty-grey hover:underline">
												{" › "}{placedIn.name}
											</Link>
										)}
									</div>
									<LocalDate value={post.createdAt} mode="absolute" className="text-xs text-dusty-grey" />
								</div>
							)}
							{post.title && (
								<h4 className="font-medium text-rich-brown mb-1">{post.title}</h4>
							)}
							<p className="text-sm text-warm-grey whitespace-pre-wrap break-words">{post.content}</p>
							{!identity && (
								<LocalDate value={post.createdAt} mode="absolute" className="text-xs text-dusty-grey mt-1" />
							)}
						</div>
					);
				})}
			</div>
			{maxPosts && posts.length > maxPosts && (
				<p className="text-sm text-misty-forest mt-2">
					+{posts.length - maxPosts} more {posts.length - maxPosts === 1 ? "post" : "posts"}
				</p>
			)}
		</div>
	);
}
