"use client";

import { useEffect, useState } from "react";
import { MarkdownBody } from "@/lib/components/markdown/MarkdownBody";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { useInlineEditSession } from "@/lib/hooks/useInlineEditSession";
import { authFetch } from "@/lib/utils/auth-client";
import { API_PROFILE_ABOUT } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";

type AboutPageClientProps = {
	entityType: "user" | "page";
	entityId: string;
	initialAboutContent: string | null;
	canEdit: boolean;
};

function AboutEditorContent({
	aboutContent,
}: {
	aboutContent: string | null;
}) {
	const session = useInlineEditSession();
	const [isEditing, setIsEditing] = useState(false);
	const [editContent, setEditContent] = useState(aboutContent ?? "");

	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditContent(aboutContent ?? "");
		setIsEditing(false);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);

	const displayValue =
		(session?.dirtyFields.aboutContent as string | undefined) ?? aboutContent;
	const hasContent = !!displayValue;

	return (
		<InlineEditable
			canEdit={!!session?.canEdit}
			isEditing={isEditing}
			onEditStart={() => {
				setEditContent(aboutContent ?? "");
				setIsEditing(true);
			}}
			onCancel={() => setIsEditing(false)}
			displayContent={
				hasContent ? (
					<MarkdownBody content={displayValue!} />
				) : (
					<p className="text-dusty-grey italic">
						Write about yourself&hellip; Click to add.
					</p>
				)
			}
			editContent={
				<textarea
					value={editContent}
					onChange={(e) => {
						setEditContent(e.target.value);
						session?.setDirty("aboutContent", e.target.value || null, aboutContent);
					}}
					placeholder="Write about yourself… (Markdown supported)"
					rows={16}
					maxLength={50000}
					className="w-full border border-gray-300 rounded-lg p-3 text-base font-mono focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown resize-y min-h-[300px]"
					autoFocus
				/>
			}
		/>
	);
}

export function AboutPageClient({
	entityType,
	entityId,
	initialAboutContent,
	canEdit,
}: AboutPageClientProps) {
	const [aboutContent, setAboutContent] = useState(initialAboutContent);

	const handleSave = async (payload: SavePayload) => {
		const value = payload.fields.aboutContent as string | null;
		const res = await authFetch(API_PROFILE_ABOUT(entityType, entityId), {
			method: "PATCH",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ aboutContent: value }),
		});
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error || "Failed to save");
		}
		const updated = await res.json();
		setAboutContent(updated.aboutContent);
		return updated;
	};

	return (
		<InlineEditSession
			resource={{ aboutContent: aboutContent ?? "" } as Record<string, unknown>}
			onSave={handleSave as (payload: SavePayload) => Promise<Record<string, unknown> | void>}
			canEdit={canEdit}
		>
			<AboutEditorContent aboutContent={aboutContent} />
		</InlineEditSession>
	);
}
