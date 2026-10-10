"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { PostItem } from "@/lib/types/post";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { OptionalTitle } from "@/lib/components/inline-editable/OptionalTitle";
import { InlinePlaceholder } from "@/lib/components/inline-editable/InlinePlaceholder";
import { TagsField } from "@/lib/components/tag/TagsField";
import { PostsList } from "@/lib/components/post/PostsList";
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { DropdownProfileSelector } from "@/lib/components/profile/DropdownProfileSelector";
import { ShareButton } from "@/lib/components/ui/ShareButton";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { Breadcrumb } from "@/lib/components/layout/Breadcrumb";
import { ContentCard } from "@/lib/components/layout/ContentCard";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { DashedPlaceholder } from "@/lib/components/ui/DashedPlaceholder";
import { LocalDate } from "@/lib/components/ui/LocalDate";
import { CommentSection } from "@/lib/components/comment/CommentSection";
import ImageCarousel from "@/lib/components/images/ImageCarousel";
import { PostImagesModal } from "@/lib/components/images/PostImagesModal";
import { deletePostAction, updatePostAction } from "@/lib/actions/post";
import type { PostUpdateData } from "@/lib/types/post";
import { useAction } from "@/lib/hooks/useAction";
import { postHasContent } from "@/lib/utils/content";
import { PencilIcon } from "@/lib/components/icons/icons";
import { EXPLORE_PAGE, EVENT_DETAIL, MESSAGE_CONVERSATION, PUBLIC_PROFILE } from "@/lib/const/routes";
import { contentIdentity } from "@/lib/utils/content-identity";
import { PostToSelector } from "@/lib/components/profile/PostToSelector";
import { getPersistedFilterUrl } from "@/lib/hooks/useFilterParams";
import { useInlineEditSession, useOnEditingClosed } from "@/lib/hooks/useInlineEditSession";
import { useInlineField } from "@/lib/hooks/useInlineField";
import type { ImageItem } from "@/lib/types/image";
import type { CommentItem } from "@/lib/types/comment";

type PostPageClientProps = {
	post: PostItem;
	images: ImageItem[];
	comments: CommentItem[];
	canEdit: boolean;
	canModerate: boolean;
	isLoggedIn: boolean;
};

/**
 * Inner content — must be inside <InlineEditSession> to access session context.
 * `post` and `images` come straight from the server render: every save is a Server Action
 * that refreshes the page, so these props are always the current server state.
 */
function PostPageContent({
	post,
	images,
	canEdit,
	canModerate,
	isLoggedIn,
}: {
	post: PostItem;
	images: ImageItem[];
	canEdit: boolean;
	canModerate: boolean;
	isLoggedIn: boolean;
}) {
	const router = useRouter();
	const session = useInlineEditSession();
	const { run: savePost } = useAction(updatePostAction);
	const { run: removePost } = useAction(deletePostAction);
	const [editingField, setEditingField] = useState<string | null>(null);

	const isDraft = post.status === "DRAFT";
	const isPublished = post.status === "PUBLISHED";
	const [isEditing, setIsEditing] = useState(isDraft);
	const { voice, placedIn } = contentIdentity({
		user: post.user!,
		page: post.page ?? null,
		asPageId: post.asPageId ?? null,
	});

	// Page carousel position + the photo-manager modal (opens at a given photo, or empty to add).
	const [carouselIndex, setCarouselIndex] = useState(0);
	const [photosModal, setPhotosModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });

	// Session-backed fields — dirtyFields is the single source of truth.
	// displayContent renders these values so edited text is visible on blur.
	const { value: title, setValue: setTitle } = useInlineField("title", post.title);
	const { value: content, setValue: setContent } = useInlineField("content", post.content);
	const { value: tags, setValue: setTags } = useInlineField<string[]>("tags", post.tags);

	// Speaking as a page puts the post on that page. Speaking as yourself
	// starts on your profile; "Post to" can add a page after that.
	const handleAuthorSwitch = (asPageId: string | null) =>
		savePost({ id: post.id, data: asPageId ? { asPageId } : { asPageId: null, pageId: null, showOnAuthorProfile: false } });

	const handlePostTo = (next: { pageId: string | null; showOnAuthorProfile: boolean }) =>
		savePost({ id: post.id, data: { asPageId: null, ...next } });

	// Close any open field when editing ends (cancel reverts values automatically
	// because dirtyFields clears and useInlineField reads from it).
	useOnEditingClosed(() => setEditingField(null));

	// Drop out of edit mode when the post transitions to PUBLISHED
	// (happens after Save-and-publish commits via onSaved)
	useEffect(() => {
		if (post.status === "PUBLISHED") setIsEditing(false);
	}, [post.status]);

	// Tracks whether this post is still a draft so the unmount cleanup always
	// has the latest value (avoids stale closure over `isDraft`).
	const shouldDiscardOnLeaveRef = useRef(isDraft && canEdit);
	useEffect(() => {
		shouldDiscardOnLeaveRef.current = post.status === "DRAFT" && canEdit;
	}, [post.status, canEdit]);

	// True once any content has been added — prevents silent deletion of non-empty drafts.
	// A title, body, OR photo all count (postHasContent), so an image-only draft survives.
	const hasContentRef = useRef(postHasContent({ title: post.title, content: post.content, imageCount: images.length }));
	useEffect(() => {
		if (postHasContent({ title: post.title, content: post.content, imageCount: images.length })) {
			hasContentRef.current = true;
		}
	}, [post.title, post.content, images.length]);
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
				// Fire-and-forget: the component is gone, so there's nothing to report to.
				void deletePostAction({ id: postId });
			}
		};
	// post.id is stable for the lifetime of this component
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	return (
		<>
			{/* Draft banner */}
			{isDraft && canEdit && (
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
				<OptionalTitle
					value={(title as string) || ""}
					onChange={(next) => setTitle(next)}
					canEdit={canEdit && isEditing}
					isEditing={editingField === "title"}
					onEditStart={() => setEditingField("title")}
					onCancel={() => setEditingField(null)}
					onCommit={() => { session?.saveAll(); }}
					showPlaceholder={isDraft && canEdit}
				/>

				{/* Author + actions row */}
				<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex-1">
						{canEdit && isDraft ? (
							<div className="space-y-2">
								<DropdownProfileSelector
									label="Posting as"
									hint="Pages you can manage"
									initialPageId={post.asPageId ?? null}
									onChange={handleAuthorSwitch}
								/>
								{post.asPageId ? (
									<p className="text-xs text-dusty-grey">Posts as {post.page?.name ?? "this page"} go on its page.</p>
								) : (
									<PostToSelector
										pageId={post.asPageId ? null : post.pageId}
										showOnProfile={post.pageId ? post.showOnAuthorProfile : true}
										onChange={handlePostTo}
									/>
								)}
							</div>
						) : (
							<ProfileTag
								entity={voice}
								size="md"
								asLink
								trailing={placedIn ? (
									<Link href={PUBLIC_PROFILE(placedIn.handle)} className="text-dusty-grey font-normal">
										{" › "}{placedIn.name}
									</Link>
								) : undefined}
							/>
						)}
					</div>
					<div className="flex flex-wrap gap-3 items-center">
						{isPublished && <ShareButton />}
						{isLoggedIn && !canEdit && (
							<Link
								href={MESSAGE_CONVERSATION({ id: post.userId, type: "user" })}
								className="px-3 py-1 text-sm font-medium border border-soft-grey rounded-full hover:bg-grey-white transition-colors"
							>
								Message
							</Link>
						)}
						{canEdit && isPublished && (
							<span className="px-3 py-1 text-xs font-semibold text-moss-green border border-melon-green rounded-full">
								Live
							</span>
						)}
					</div>
				</div>

				{isPublished && (
					<LocalDate
						value={post.createdAt}
						mode="absolute"
						prefix="Posted "
						className="text-xs text-dusty-grey"
					/>
				)}

				{/* Content */}
				<InlineEditable
					canEdit={canEdit && isEditing}
					isEditing={editingField === "content"}
					onEditStart={() => setEditingField("content")}
					onCancel={() => setEditingField(null)}
					displayContent={(() => {
						const body = (
							<InlinePlaceholder value={content as string} placeholder="What are you working on or thinking about?">
								<p className="text-base leading-relaxed text-warm-grey whitespace-pre-wrap break-words">{content as string}</p>
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
				{images.length > 0 ? (
					<ImageCarousel
						images={images}
						currentIndex={carouselIndex}
						onIndexChange={setCarouselIndex}
						showCaptions
						onEditImage={canEdit && isEditing ? (i) => setPhotosModal({ open: true, index: i }) : undefined}
					/>
				) : (
					canEdit && isEditing && (
						<DashedPlaceholder className="p-6 flex justify-center">
							<button
								type="button"
								onClick={() => setPhotosModal({ open: true, index: 0 })}
								className="text-sm font-medium text-misty-forest hover:text-rich-brown transition-colors"
							>
								+ Add photos
							</button>
						</DashedPlaceholder>
					)
				)}

				{/* Photo manager modal — owner only. Manages the whole set (preview + caption + add + remove). */}
				{canEdit && photosModal.open && (
					<PostImagesModal
						isOpen
						onClose={() => setPhotosModal({ open: false, index: 0 })}
						postId={post.id}
						images={images}
						initialIndex={photosModal.index}
					/>
				)}

				{/* Tags */}
				<TagsField
					value={tags as string[]}
					onChange={(newTags) => setTags(newTags)}
					isOwner={canEdit}
					isEditing={isEditing}
					editingField={editingField}
					onEditStart={() => setEditingField("tags")}
					onCancel={() => setEditingField(null)}
				/>

				{/* Child updates */}
				{post.parentPostId === null && (
					<PostsList collectionId={post.id} collectionType="post" showTitle />
				)}

				{/* Footer actions */}
				{(canEdit || canModerate) && (
					<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-soft-grey">
						{canModerate && (
							<DeleteConfirmButton
								label="Delete Post"
								itemTitle={post.title || post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "")}
								onDelete={async () => {
									const result = await removePost({ id: post.id });
									if (result.ok) router.push(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE));
									else if (result.error !== "unauthorized") throw new Error(result.message);
								}}
							/>
						)}
						{canEdit && isPublished && !isEditing && (
							<button
								type="button"
								onClick={() => setIsEditing(true)}
								className="flex items-center gap-1.5 text-sm font-medium text-misty-forest hover:text-rich-brown transition-colors cursor-pointer"
							>
								<PencilIcon className="w-3.5 h-3.5" />
								Edit
							</button>
						)}
						{canEdit && isPublished && isEditing && (
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

export function PostPageClient({ post, images, comments, canEdit, canModerate, isLoggedIn }: PostPageClientProps) {
	const { run: savePost } = useAction(updatePostAction);
	const [exploreHref, setExploreHref] = useState(EXPLORE_PAGE);
	useEffect(() => { setExploreHref(getPersistedFilterUrl(EXPLORE_PAGE, EXPLORE_PAGE)); }, []);

	const isDraft = post.status === "DRAFT";
	const isPublished = post.status === "PUBLISHED";

	return (
		<PostPageShell breadcrumb={<Breadcrumb href={exploreHref} label="Back to Explore" />}>
			<ContentCard>
				<InlineEditSession
					resource={post as unknown as Record<string, unknown>}
					onSave={async ({ fields }) => {
						// The action refreshes the page, so the saved values arrive as new props.
						const result = await savePost({ id: post.id, data: fields as PostUpdateData });
						if (!result.ok) throw new Error(result.message);
					}}
					canEdit={canEdit}
					publishable={canEdit && isDraft}
					canPublish={(current) => postHasContent({ title: current.title as string | null, content: current.content as string | null, imageCount: images.length })}
					publishHint="Add a title, some content, or a photo to publish"
				>
					<PostPageContent
						post={post}
						images={images}
						canEdit={canEdit}
						canModerate={canModerate}
						isLoggedIn={isLoggedIn}
					/>
				</InlineEditSession>
			</ContentCard>

			{/* Comments live below the post, in their own card. Published posts only —
			    a draft is visible only to its owner and can't yet be commented on. */}
			{isPublished && (
				<CommentSection
					target={{ kind: "post", id: post.id }}
					comments={comments}
					ownerUserId={post.userId}
					ownerPageId={post.pageId}
					isContentOwner={canModerate}
					isLoggedIn={isLoggedIn}
				/>
			)}
		</PostPageShell>
	);
}
