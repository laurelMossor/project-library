"use client";

import { useEffect, useState } from "react";
import { PostItem } from "@/lib/types/post";
import { CollectionType } from "@/lib/types/collection";
import { getPosts } from "@/lib/utils/post-client";
import { formatDateTime } from "@/lib/utils/datetime";
import { AtSignIcon } from "../icons/icons";
import Link from "next/link";
import { PUBLIC_USER_PAGE, PUBLIC_ORG_PAGE } from "@/lib/const/routes";

// Minimal owner type for posts - only includes fields returned by API
type PostOwnerUser = {
	id: string;
	username: string;
	displayName: string | null;
	firstName: string | null;
	lastName: string | null;
};

type PostOwnerOrg = {
	id: string;
	name: string;
	slug: string;
};

type PostOwner = {
	id: string;
	type: "USER" | "ORG";
	user: PostOwnerUser | null;
	org: PostOwnerOrg | null;
};

function getPostOwnerDisplayName(owner: PostOwner): string {
	if (owner.type === "USER" && owner.user) {
		return owner.user.displayName || 
			[owner.user.firstName, owner.user.lastName].filter(Boolean).join(" ") || 
			owner.user.username;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.name;
	}
	return "Unknown";
}

function getPostOwnerHandle(owner: PostOwner): string | null {
	if (owner.type === "USER" && owner.user) {
		return owner.user.username;
	}
	if (owner.type === "ORG" && owner.org) {
		return owner.org.slug;
	}
	return null;
}

function getPostOwnerInitials(owner: PostOwner): string {
	if (owner.type === "ORG" && owner.org) {
		const words = owner.org.name.trim().split(/\s+/);
		if (words.length >= 2) {
			return (words[0][0] + words[1][0]).toUpperCase();
		}
		return owner.org.name.substring(0, 2).toUpperCase();
	}
	if (owner.type === "USER" && owner.user) {
		if (owner.user.firstName && owner.user.lastName) {
			return (owner.user.firstName[0] + owner.user.lastName[0]).toUpperCase();
		}
		if (owner.user.firstName) return owner.user.firstName[0].toUpperCase();
		return owner.user.username[0].toUpperCase();
	}
	return "?";
}

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
					// Build owner from post data
					const owner: PostOwner | null = post.owner ? {
						id: post.owner.id,
						type: post.owner.type,
						user: post.owner.user ? {
							id: post.owner.user.id,
							username: post.owner.user.username,
							displayName: post.owner.user.displayName,
							firstName: post.owner.user.firstName,
							lastName: post.owner.user.lastName,
						} : null,
						org: post.owner.org ? {
							id: post.owner.org.id,
							name: post.owner.org.name,
							slug: post.owner.org.slug,
						} : null,
					} : null;

					const ownerDisplayName = owner ? getPostOwnerDisplayName(owner) : null;
					const ownerHandle = owner ? getPostOwnerHandle(owner) : null;
					const isOrg = owner?.type === "ORG";
					const ownerHref = owner && ownerHandle
						? (isOrg ? PUBLIC_ORG_PAGE(ownerHandle) : PUBLIC_USER_PAGE(ownerHandle))
						: "#";
					const initials = owner ? getPostOwnerInitials(owner) : "?";

					return (
						<div key={post.id} className="border-l-2 border-soft-grey pl-4 py-2">
							{/* Owner attribution */}
							{owner && ownerDisplayName && (
								<div className="flex items-center gap-2 mb-2">
									{/* Inline avatar for posts */}
									<Link 
										href={ownerHref}
										className="w-8 h-8 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity text-xs text-gray-600 font-medium"
									>
										{initials}
									</Link>
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

