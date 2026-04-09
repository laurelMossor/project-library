import { prisma } from "@/lib/utils/server/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { postWithUserFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { PostsList } from "@/lib/components/post/PostsList";
import { DeletePostButton } from "@/lib/components/post/DeletePostButton";
import { DraftPageShell } from "@/lib/components/layout/PostPageShell";
import { DraftContentArea } from "@/lib/components/layout/PostContentArea";
import { ProfileTag } from "@/lib/components/profile/ProfileTag";
import { EVENT_DETAIL, EXPLORE_PAGE } from "@/lib/const/routes";
import ImageCarousel from "@/lib/components/images/ImageCarousel";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function PostDetailPage({ params }: Props) {
	const { id } = await params;
	const session = await auth();

	const post = await prisma.post.findUnique({
		where: { id },
		select: postWithUserFields,
	});

	if (!post) {
		notFound();
	}

	const images = await getImagesForTarget("POST", id);
	const isOwner = session?.user?.id === post.userId;
	const entity = post.page ?? post.user!;
	const postTitle = post.title || post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "");

	return (
		<DraftPageShell>
			<DraftContentArea>
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
				{post.title && (
					<h1 className="text-4xl font-bold text-rich-brown leading-tight">
						{post.title}
					</h1>
				)}

				{/* Author */}
				<ProfileTag entity={entity} size="md" asLink />

				{/* Body */}
				<p className="text-base leading-relaxed text-gray-700 whitespace-pre-wrap">
					{post.content}
				</p>

				{/* Images */}
				{images.length > 0 && (
					<ImageCarousel images={images} showCaptions />
				)}

				{/* Tags */}
				{post.tags.length > 0 && (
					<div className="flex flex-wrap gap-2">
						{post.tags.map((tag) => (
							<span
								key={tag}
								className="px-3 py-1 bg-melon-green border border-ash-green text-misty-forest text-xs rounded-full"
							>
								{tag}
							</span>
						))}
					</div>
				)}

				{/* Child updates */}
				<PostsList collectionId={id} collectionType="post" showTitle={true} />

				{/* Footer actions */}
				<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
					{isOwner && (
						<DeletePostButton postId={id} postTitle={postTitle} />
					)}
					<Link
						href={EXPLORE_PAGE}
						className="text-sm font-medium text-gray-500 hover:text-rich-brown underline underline-offset-2"
					>
						Explore
					</Link>
				</div>
			</DraftContentArea>
		</DraftPageShell>
	);
}
