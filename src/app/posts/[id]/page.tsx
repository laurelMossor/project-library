import { prisma } from "@/lib/utils/server/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { postWithUserFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { toPostCollectionItem } from "@/lib/types/post";
import { CollectionCard } from "@/lib/components/collection/CollectionCard";
import { PostsList } from "@/lib/components/post/PostsList";
import { DeletePostButton } from "@/lib/components/post/DeletePostButton";
import { CenteredLayout } from "@/lib/components/layout/CenteredLayout";
import { EVENT_DETAIL, EXPLORE_PAGE } from "@/lib/const/routes";

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

	// Load images
	const images = await getImagesForTarget("POST", id);

	// Convert to collection item for rendering
	const postItem = toPostCollectionItem({
		...post,
		images,
	});

	const isOwner = session?.user?.id === post.userId;
	const postTitle = post.title || post.content.substring(0, 40) + (post.content.length > 40 ? "..." : "");

	return (
		<CenteredLayout maxWidth="2xl">
			{/* Breadcrumb: event link if applicable */}
			{post.event && (
				<p className="text-sm text-gray-500 mb-4">
					Part of:{" "}
					<Link href={EVENT_DETAIL(post.event.id)} className="text-rich-brown hover:underline">
						{post.event.title || "Untitled Event"}
					</Link>
				</p>
			)}

			<CollectionCard item={postItem} truncate={false} showCaptions={true} />

			{/* Child updates */}
			<PostsList collectionId={id} collectionType="post" showTitle={true} />

			{/* Actions */}
			<div className="mt-8 flex gap-4 items-center flex-wrap">
				{isOwner && (
					<DeletePostButton postId={id} postTitle={postTitle} />
				)}
				<Link href={EXPLORE_PAGE} className="text-sm text-gray-500 hover:underline">
					Back to Explore
				</Link>
			</div>
		</CenteredLayout>
	);
}
