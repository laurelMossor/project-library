"use client";

import { createDraftPostAction } from "@/lib/actions/post";
import { CreateDraftRedirect } from "@/lib/components/layout/CreateDraftRedirect";
import { POST_DETAIL } from "@/lib/const/routes";

/**
 * /posts/new — Creates a draft post pre-populated with the active profile,
 * then redirects to the post page for inline editing.
 */
export default function NewPostPage() {
	return <CreateDraftRedirect create={createDraftPostAction} detailHref={POST_DETAIL} noun="post" />;
}
