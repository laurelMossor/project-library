import { prisma } from "@/lib/utils/server/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { postWithUserFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { PostPageClient } from "@/lib/components/post/PostPageClient";

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

	const isOwner = session?.user?.id === post.userId;

	// Non-owners cannot see DRAFT posts
	if (post.status === "DRAFT" && !isOwner) {
		notFound();
	}

	const images = await getImagesForTarget("POST", id);

	return (
		<PostPageClient
			post={post}
			images={images}
			isOwner={isOwner}
		/>
	);
}
