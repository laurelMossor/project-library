"use client";

import { useEffect, useState } from "react";
import { PostItem } from "@/lib/types/post";
import { CollectionType } from "@/lib/types/collection";
import { getPosts } from "@/lib/utils/post-client";
import { formatDateTime } from "@/lib/utils/datetime";
import { OwnerAvatar } from "../user/OwnerAvatar";
import { getOwnerDisplayName, getOwnerHandle, isOrgOwner, PublicOwner } from "@/lib/utils/owner";
import { AtSignIcon } from "../icons/icons";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

type PostsListProps = {
	collectionId: string;
	collectionType: CollectionType;
	showTitle?: boolean;
	maxPosts?: number; // For card view, limit number of posts shown
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
				const data = await getPosts(collectionId, collectionType);
				setPosts(data);
			} catch (err) {
				setError("Failed to load posts");
			} finally {
				setLoading(false);
			}
		}
		loadPosts();
	}, [collectionId, collectionType]);

	if (loading) {
		return <div className="text-sm text-gray-500">Loading posts...</div>;
	}

	if (error) {
		return <div className="text-sm text-red-500">{error}</div>;
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
					// Convert post.owner to PublicOwner format if it exists
					const owner: PublicOwner | null = post.owner ? {
						id: post.owner.id,
						type: post.owner.type as "USER" | "ORG",
						user: post.owner.user || null,
						org: post.owner.org || null,
					} : null;

					const ownerDisplayName = owner ? getOwnerDisplayName(owner) : null;
					const ownerHandle = owner ? getOwnerHandle(owner) : null;
					const isOrg = owner ? isOrgOwner(owner) : false;
					const ownerHref = owner && ownerHandle
						? (isOrg ? PUBLIC_ORG_PAGE(ownerHandle) : PUBLIC_USER_PAGE(ownerHandle))
						: "#";

					return (
						<div key={post.id} className="border-l-2 border-soft-grey pl-4 py-2">
							{/* Owner attribution */}
							{owner && ownerDisplayName && (
								<div className="flex items-center gap-2 mb-2">
									<OwnerAvatar owner={owner} size="sm" />
									<div className="flex items-center gap-1">
										{isOrg && (
											<AtSignIcon className="w-3 h-3 text-gray-500" />
										)}
										<Link
											href={ownerHref}
											className="text-xs text-rich-brown hover:underline font-medium"
										>
											{ownerDisplayName}
										</Link>
									</div>
									<span className="text-xs text-gray-400">
										{formatDateTime(post.createdAt)}
									</span>
								</div>
							)}
							{post.title && (
								<h4 className="font-medium text-rich-brown mb-1">{post.title}</h4>
							)}
							<p className="text-sm text-warm-grey whitespace-pre-wrap">{post.content}</p>
							{!owner && (
								<p className="text-xs text-gray-400 mt-1">
									{formatDateTime(post.createdAt)}
								</p>
							)}
						</div>
					);
				})}
			</div>
			{maxPosts && posts.length > maxPosts && (
				<p className="text-sm text-gray-500 mt-2">
					+{posts.length - maxPosts} more {posts.length - maxPosts === 1 ? "post" : "posts"}
				</p>
			)}
		</div>
	);
}

