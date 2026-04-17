"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PostItem } from "@/lib/types/post";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { PostsList } from "@/lib/components/post/PostsList";
import { DeletePostButton } from "@/lib/components/post/DeletePostButton";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { Tag } from "@/lib/components/tag/Tag";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import ImageCarousel from "@/lib/components/images/ImageCarousel";
import { updatePost, publishPost, deletePost } from "@/lib/utils/post-client";
import { AuthError } from "@/lib/utils/auth-client";
import { EXPLORE_PAGE, EVENT_DETAIL, LOGIN_WITH_CALLBACK, POST_DETAIL } from "@/lib/const/routes";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import type { ImageItem } from "@/lib/types/image";

type PostPageClientProps = {
	post: PostItem;
	images: ImageItem[];
	isOwner: boolean;
};

/** Inner content — must be inside <InlineEditSession> to access session context */
function PostPageContent({
	post,
	setPost,
	images,
	isOwner,
}: {
	post: PostItem;
	setPost: React.Dispatch<React.SetStateAction<PostItem>>;
	images: ImageItem[];
	isOwner: boolean;
}) {
	const router = useRouter();
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);
	const [publishing, setPublishing] = useState(false);

	const [editTitle, setEditTitle] = useState(post.title);
	const [editContent, setEditContent] = useState(post.content);
	const [editTagsArr, setEditTagsArr] = useState<string[]>(post.tags);

	const isDraft = post.status === "DRAFT";
	const entity = post.page ?? post.user!;
	const isDirty = session ? Object.keys(session.dirtyFields).length > 0 : false;

	// When session cancels, revert all field states
	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditTitle(post.title);
		setEditContent(post.content);
		setEditTagsArr(post.tags);
		setEditingField(null);
	// cancelRevision changing is the only trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);


	// Tracks whether this post is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && isOwner);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = post.status === "DRAFT" && isOwner;
	}, [post.status, isOwner]);

	// When the owner navigates away from an unpublished draft, delete it silently.
	useEffect(() => {
		const postId = post.id;
		let armed = false;
		const armTimer = setTimeout(() => { armed = true; }, 0);
		return () => {
			clearTimeout(armTimer);
			if (armed && shouldDiscardOnLeaveRef.current) {
				deletePost(postId).catch(() => {});
			}
		};
	// post.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const handlePublish = async () => {
		setPublishing(true);
		try {
			const updated = await publishPost(post.id);
			setPost((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) {
				router.push(LOGIN_WITH_CALLBACK(POST_DETAIL(post.id)));
			}
		} finally {
			setPublishing(false);
		}
	};

	return (
		<>
			{/* Draft banner */}
			{isDraft && isOwner && (
				<div className="bg-alice-blue px-6 py-3 text-center text-sm font-medium text-whale-blue">
					Draft — only you can see this
				</div>
			)}

			<PostContentArea>
				{/* Breadcrumb: event link if applicable */}
				{post.event && (
					<p className="text-sm text-misty-forest">
						Part of:{" "}
						<Link href={EVENT_DETAIL(post.event.id)} className="text-rich-brown hover:underline">
							{post.event.title || "Untitled Event"}
						</Link>
					</p>
				)}

				{/* Title */}
				<InlineEditable
					canEdit={isOwner}
					isEditing={editingField === "title"}
					onEditStart={() => {
						setEditTitle(post.title);
						setEditingField("title");
					}}
					onCancel={() => {
						setEditingField(null);
						
					}}
					displayContent={
						post.title ? (
							<h1 className="text-4xl font-bold text-rich-brown leading-tight">{post.title}</h1>
						) : (
							<h1 className="text-4xl leading-tight font-normal italic text-misty-forest/50">
								{isOwner ? "Title (optional)" : "Untitled Post"}
							</h1>
						)
					}
					editContent={
						<input
							type="text"
							value={editTitle || ""}
							onChange={(e) => { setEditTitle(e.target.value); session?.setDirty("title", e.target.value, post.title); }}
							placeholder="Title (optional)"
							maxLength={150}
							className="w-full text-4xl leading-tight border-none outline-none bg-transparent font-bold text-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Author + actions row */}
				<div className="flex items-center justify-between gap-4">
					<ProfileTag entity={entity} size="md" asLink />
					<div className="flex gap-3 items-center">
						{isOwner && isDraft && (
							<button
								type="button"
								onClick={handlePublish}
								disabled={publishing || isDirty || !post.content.trim()}
								title={isDirty ? "Save your changes before publishing" : !post.content.trim() ? "Add some content before publishing" : undefined}
								className="px-5 py-2 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
							>
								{publishing ? "Publishing..." : "Publish"}
							</button>
						)}
						{!isDraft && isOwner && (
							<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
								Live
							</span>
						)}
					</div>
				</div>

				{/* Content */}
				<InlineEditable
					canEdit={isOwner}
					isEditing={editingField === "content"}
					onEditStart={() => {
						setEditContent(post.content);
						setEditingField("content");
					}}
					onCancel={() => {
						setEditingField(null);
						
					}}
					displayContent={
						<div className={`p-3 rounded-lg min-h-[10rem] ${!post.content ? "bg-melon-green/10 border border-dashed border-ash-green/60" : ""}`}>
							<InlinePlaceholder value={post.content} placeholder="What are you working on or thinking about?">
								<p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">{post.content}</p>
							</InlinePlaceholder>
						</div>
					}
					editContent={
						<textarea
							value={editContent}
							onChange={(e) => { setEditContent(e.target.value); session?.setDirty("content", e.target.value, post.content); }}
							placeholder="What are you working on or thinking about?"
							rows={8}
							maxLength={10000}
							className="w-full text-base leading-relaxed text-gray-700 border border-ash-green rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Images */}
				{images.length > 0 && <ImageCarousel images={images} showCaptions />}

				{/* Tags */}
				<InlineEditable
					canEdit={isOwner}
					isEditing={editingField === "tags"}
					onEditStart={() => {
						setEditTagsArr(post.tags);
						setEditingField("tags");
					}}
					onCancel={() => {
						setEditingField(null);
						
					}}
					displayContent={
						post.tags.length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{post.tags.map((tag) => <Tag key={tag} tag={tag} />)}
							</div>
						) : (
							<InlinePlaceholder value={null} placeholder="Add topics" />
						)
					}
					editContent={
						<TagInputField tags={editTagsArr} onTagsChange={(tags) => { setEditTagsArr(tags); session?.setDirty("tags", tags, post.tags); }} />
					}
				/>

				{/* Child updates */}
				{post.parentPostId === null && (
					<PostsList collectionId={post.id} collectionType="post" showTitle />
				)}

				{/* Footer actions */}
				<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
					{isOwner && (
						<DeletePostButton
							postId={post.id}
							postTitle={post.title || post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "")}
						/>
					)}
					<Link
						href={EXPLORE_PAGE}
						className="text-sm font-medium text-gray-500 hover:text-rich-brown underline underline-offset-2"
					>
						Explore
					</Link>
				</div>
			</PostContentArea>
		</>
	);
}

export function PostPageClient({ post: initialPost, images, isOwner }: PostPageClientProps) {
	const [post, setPost] = useState(initialPost);

	return (
		<PostPageShell>
			<InlineEditSession
				resource={post as unknown as Record<string, unknown>}
				onSave={async (patch) => {
					const updated = await updatePost(post.id, patch as Parameters<typeof updatePost>[1]);
					setPost((prev) => ({ ...prev, ...updated }));
					return updated as unknown as Record<string, unknown>;
				}}
				onSaved={(updated) => {
					setPost((prev) => ({ ...prev, ...(updated as Partial<PostItem>) }));
				}}
				canEdit={isOwner}
			>
				<PostPageContent
					post={post}
					setPost={setPost}
					images={images}
					isOwner={isOwner}
				/>
			</InlineEditSession>
		</PostPageShell>
	);
}
