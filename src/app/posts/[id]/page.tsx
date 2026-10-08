import { prisma } from "@/lib/utils/server/prisma";
import { auth } from "@/lib/auth";
import { notFound } from "next/navigation";
import { postWithUserFields } from "@/lib/utils/server/fields";
import { getImagesForTarget } from "@/lib/utils/server/image-attachment";
import { PostPageClient } from "@/lib/components/post/PostPageClient";
import { getViewerContext, canViewPost } from "@/lib/utils/server/visibility";
import { canEditContent, canModerateContent } from "@/lib/utils/server/permission";

type Props = {
	params: Promise<{ id: string }>;
};

export default async function PostDetailPage({ params }: Props) {
	const { id } = await params;
	const [session, viewer] = await Promise.all([auth(), getViewerContext()]);

	const post = await prisma.post.findUnique({
		where: { id },
		select: postWithUserFields,
	});

	if (!post) {
		notFound();
	}

	const isLoggedIn = !!session?.user?.id;
	const authority = { userId: post.userId, asPageId: post.asPageId, pageId: post.pageId };
	const [canEdit, canModerate] = session?.user?.id
		? await Promise.all([
			canEditContent(session.user.id, authority),
			canModerateContent(session.user.id, authority),
		])
		: [false, false];

	// Drafts are visible to whoever may edit the words (the author, or a current
	// editor of page-spoken content). A member post's draft stays with its author.
	if (post.status === "DRAFT" && !canEdit) {
		notFound();
	}

	// Visibility gate: PRIVATE posts are 404 for unauthorized viewers
	if (!(await canViewPost(post, viewer))) {
		notFound();
	}

	const images = await getImagesForTarget("POST", id);

	return (
		<PostPageClient
			post={post}
			images={images}
			canEdit={canEdit}
			canModerate={canModerate}
			isLoggedIn={isLoggedIn}
		/>
	);
}
