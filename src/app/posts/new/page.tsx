import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { createDraftPost } from "@/lib/utils/server/post";
import { LOGIN_WITH_CALLBACK, POST_NEW, POST_DETAIL } from "@/lib/const/routes";

/**
 * POST NEW
 *
 * Server action page: creates a minimal DRAFT post then redirects to the
 * detail route, which is the single editing surface for all post authoring.
 * There is no create form — all fields are filled in via inline editing.
 */
export default async function NewPostPage() {
	const session = await auth();

	if (!session?.user?.id) {
		redirect(LOGIN_WITH_CALLBACK(POST_NEW));
	}

	const post = await createDraftPost(session.user.id);
	redirect(POST_DETAIL(post.id));
}
