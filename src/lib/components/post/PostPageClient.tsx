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
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { Tag } from "@/lib/components/tag/Tag";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { ContentCard } from "@/lib/components/layout/ContentCard";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { CommentSection } from "@/lib/components/comment/CommentSection";
import ImageCarousel from "@/lib/components/images/ImageCarousel";
import { updatePost, deletePost } from "@/lib/utils/post-client";
import { AuthError } from "@/lib/utils/auth-client";
import { PencilIcon } from "@/lib/components/icons/icons";
import { EXPLORE_PAGE, EVENT_DETAIL, LOGIN_WITH_CALLBACK, POST_DETAIL, MESSAGE_CONVERSATION } from "@/lib/const/routes";
import { getPersistedFilterUrl } from "@/lib/hooks/useFilterParams";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import type { ImageItem } from "@/lib/types/image";

type PostPageClientProps = {
	post: PostItem;
	images: ImageItem[];
	isOwner: boolean;
	isLoggedIn: boolean;
};

/** Inner content — must be inside <InlineEditSession> to access session context */
function PostPageContent({
	post,
	setPost,
	images,
	isOwner,
	isLoggedIn,
}: {
	post: PostItem;
	setPost: React.Dispatch<React.SetStateAction<PostItem>>;
	images: ImageItem[];
	isOwner: boolean;
	isLoggedIn: boolean;
}) {
	const router = useRouter();
	const session = useInlineEditSession();
	const [editingField, setEditingField] = useState<string | null>(null);

	const isDraft = post.status === "DRAFT";
	const isPublished = post.status === "PUBLISHED";
	const [isEditing, setIsEditing] = useState(isDraft);
	const entity = post.page ?? post.user!;

	// Session-backed fields — dirtyFields is the single source of truth.
	// displayContent renders these values so edited text is visible on blur.
	const { value: title, setValue: setTitle } = useInlineField("title", post.title);
	const { value: content, setValue: setContent } = useInlineField("content", post.content);
	const { value: tags, setValue: setTags } = useInlineField<string[]>("tags", post.tags);

	const handleAuthError = () => {
		router.push(LOGIN_WITH_CALLBACK(POST_DETAIL(post.id)));
	};

	const handleAuthorSwitch = async (pageId: string | null) => {
		try {
			const updated = await updatePost(post.id, { pageId });
			setPost((prev) => ({ ...prev, ...updated }));
		} catch (err) {
			if (err instanceof AuthError) handleAuthError();
		}
	};

	// When session cancels, close any open edit field (values revert automatically
	// because dirtyFields clears and useInlineField reads from it).
	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditingField(null);
	// cancelRevision is the only intended trigger
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	// Drop out of edit mode when the post transitions to PUBLISHED
	// (happens after Save-and-publish commits via onSaved)
	useEffect(() => {
		if (post.status === "PUBLISHED") setIsEditing(false);
	}, [post.status]);

	// Tracks whether this post is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && isOwner);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = post.status === "DRAFT" && isOwner;
	}, [post.status, isOwner]);

	// True once any content has been added — prevents silent deletion of non-empty drafts.
	const hasContentRef = useRef(Boolean(post.title || post.content));
	useEffect(() => {
		if (post.title || post.content) hasContentRef.current = true;
	}, [post.title, post.content]);
	const dirtyCount = session ? Object.keys(session.dirtyFields).length : 0;
	useEffect(() => {
		if (dirtyCount > 0) hasContentRef.current = true;
	}, [dirtyCount]);

	// When the owner navigates away from an unpublished EMPTY draft, delete it silently.
	useEffect(() => {
		const postId = post.id;
		let armed = false;
		const armTimer = setTimeout(() => { armed = true; }, 0);
		return () => {
			clearTimeout(armTimer);
			if (armed && shouldDiscardOnLeaveRef.current && !hasContentRef.current) {
				deletePost(postId).catch(() => {});
			}
		};
	// post.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

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
					canEdit={isOwner && isEditing}
					isEditing={editingField === "title"}
					onEditStart={() => setEditingField("title")}
					onCancel={() => setEditingField(null)}
					displayContent={
						title ? (
							<h1 className="text-4xl font-bold text-rich-brown leading-tight">{title as string}</h1>
						) : isDraft && isOwner ? (
							<h1 className="text-4xl leading-tight font-normal italic text-misty-forest/50">
								Title (optional)
							</h1>
						) : null
					}
					editContent={
						<input
							type="text"
							value={(title as string) || ""}
							onChange={(e) => setTitle(e.target.value)}
							onBlur={() => setEditingField(null)}
							onKeyDown={(e) => {
								if (e.key === "Enter") {
									e.preventDefault();
									setEditingField(null);
									session?.saveAll();
								}
							}}
							placeholder="Title (optional)"
							maxLength={150}
							className="w-full text-4xl leading-tight border-none outline-none bg-transparent font-bold text-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Author + actions row */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex-1">
						{isOwner && isDraft ? (
							<DropdownProfileSelector
								initialPageId={post.page?.id ?? null}
								onChange={handleAuthorSwitch}
							/>
						) : (
							<ProfileTag entity={entity} size="md" asLink />
						)}
					</div>
					<div className="flex flex-wrap gap-3 items-center">
						{isPublished && <ShareButton />}
						{isLoggedIn && !isOwner && (
							<Link
								href={MESSAGE_CONVERSATION({ id: post.userId, type: "user" })}
								className="px-3 py-1 text-sm font-medium border border-soft-grey rounded-full hover:bg-grey-white transition-colors"
							>
								Message
							</Link>
						)}
						{isOwner && isPublished && (
							<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
								Live
							</span>
						)}
					</div>
				</div>

				{/* Content */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "content"}
					onEditStart={() => setEditingField("content")}
					onCancel={() => setEditingField(null)}
					displayContent={(() => {
						const body = (
							<InlinePlaceholder value={content as string} placeholder="What are you working on or thinking about?">
								<p className="text-base leading-relaxed text-warm-grey whitespace-pre-wrap">{content as string}</p>
							</InlinePlaceholder>
						);
						return (content as string)
							? <div className="p-3 rounded-lg min-h-[10rem]">{body}</div>
							: <DashedPlaceholder className="p-3 min-h-[10rem]">{body}</DashedPlaceholder>;
					})()}
					editContent={
						<textarea
							value={(content as string) || ""}
							onChange={(e) => setContent(e.target.value)}
							placeholder="What are you working on or thinking about?"
							rows={8}
							maxLength={10000}
							className="w-full text-base leading-relaxed text-warm-grey border border-ash-green rounded-lg p-3 focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
							autoFocus
						/>
					}
				/>

				{/* Images */}
				{images.length > 0 && <ImageCarousel images={images} showCaptions isOwner={isOwner && isEditing} />}

				{/* Tags */}
				<InlineEditable
					canEdit={isOwner && isEditing}
					isEditing={editingField === "tags"}
					onEditStart={() => setEditingField("tags")}
					onCancel={() => setEditingField(null)}
					displayContent={
						(tags as string[]).length > 0 ? (
							<div className="flex flex-wrap gap-2">
								{(tags as string[]).map((tag) => <Tag key={tag} tag={tag} />)}
							</div>
						) : (
							<InlinePlaceholder value={null} placeholder="Add topics" />
						)
					}
					editContent={
						<TagInputField
							tags={tags as string[]}
							onTagsChange={(newTags) => setTags(newTags)}
						/>
					}
				/>

				{/* Child updates */}
				{post.parentPostId === null && (
					<PostsList collectionId={post.id} collectionType="post" showTitle />
				)}

				{/* Footer actions */}
				{isOwner && (
					<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-soft-grey">
						<DeleteConfirmButton
							label="Delete Post"
							itemTitle={post.title || post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "")}
							onDelete={async () => {
								try {
									await deletePost(post.id);
									router.push(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE));
								} catch (err) {
									if (err instanceof AuthError) { handleAuthError(); return; }
									throw err;
								}
							}}
						/>
						{isPublished && !isEditing && (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="flex items-center gap-1.5 text-sm font-medium text-misty-forest hover:text-rich-brown transition-colors cursor-pointer"
							>
								<PencilIcon className="w-3.5 h-3.5" />
								Edit
							</button>
						)}
						{isPublished && isEditing && (
							<button
								type="button"
								onClick={async () => {
									if (session && Object.keys(session.dirtyFields).length > 0) await session.saveAll();
									setIsEditing(false);
								}}
								className="text-sm font-medium text-moss-green hover:text-rich-brown transition-colors cursor-pointer"
							>
								Done
							</button>
						)}
					</div>
				)}
			</PostContentArea>
		</>
	);
}

export function PostPageClient({ post: initialPost, images, isOwner, isLoggedIn }: PostPageClientProps) {
	const [post, setPost] = useState(initialPost);
	const [exploreHref, setExploreHref] = useState(EXPLORE_PAGE);
	useEffect(() => { setExploreHref(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE)); }, []);

	const isDraft = post.status === "DRAFT";
	const isPublished = post.status === "PUBLISHED";

	return (
		<PostPageShell breadcrumb={
			<Link href={exploreHref} className="text-sm text-misty-forest hover:text-rich-brown hover:underline">
				&larr; Back to Explore
			</Link>
		}>
			<ContentCard>
				<InlineEditSession
					resource={post as unknown as Record<string, unknown>}
					onSave={async ({ fields }) => {
						const updated = await updatePost(post.id, fields as Parameters<typeof updatePost>[1]);
						setPost((prev) => ({ ...prev, ...updated }));
						return updated as unknown as Record<string, unknown>;
					}}
					onSaved={(updated) => {
						setPost((prev) => ({ ...prev, ...(updated as Partial<PostItem>) }));
					}}
					canEdit={isOwner}
					publishable={isOwner && isDraft}
					canPublish={(current) => Boolean((current.content as string)?.trim())}
					publishHint="Add some content to publish"
				>
					<PostPageContent
						post={post}
						setPost={setPost}
						images={images}
						isOwner={isOwner}
						isLoggedIn={isLoggedIn}
					/>
				</InlineEditSession>
			</ContentCard>

			{/* Comments live below the post, in their own card. Published posts only —
			    a draft is visible only to its owner and can't yet be commented on. */}
			{isPublished && (
				<CommentSection
					target={{ kind: "post", id: post.id }}
					ownerUserId={post.userId}
					ownerPageId={post.pageId}
					isContentOwner={isOwner}
					isLoggedIn={isLoggedIn}
				/>
			)}
		</PostPageShell>
	);
}
