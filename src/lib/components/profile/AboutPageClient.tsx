"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { InlineEditSession } from "@/lib/components/inline-editable/InlineEditSession";
import { InlineEditable } from "@/lib/components/inline-editable/InlineEditable";
import { DeleteConfirmButton } from "@/lib/components/ui/DeleteConfirmButton";
import { useInlineEditSession, useOnEditingClosed } from "@/lib/hooks/useInlineEditSession";
import { useAction } from "@/lib/hooks/useAction";
import { saveProfileAction } from "@/lib/actions/profile";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import type { SavePayload } from "@/lib/types/inline-edit";
import type { ProfileTarget } from "@/lib/types/profile";

type AboutPageClientProps = {
	entityType: "user" | "page";
	entityId: string;
	handle: string;
	aboutContent: string | null;
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

	// Revert the draft only on cancel; close the editor whenever editing ends.
	const cancelRevision = session?.cancelRevision ?? 0;
	useEffect(() => {
		if (cancelRevision === 0) return;
		setEditContent(aboutContent ?? "");
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [cancelRevision]);
	useOnEditingClosed(() => setIsEditing(false));

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
					<div className="whitespace-pre-wrap leading-relaxed">{displayValue}</div>
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
					placeholder="Write about yourself…"
					rows={16}
					maxLength={50000}
					className="w-full border border-gray-300 rounded-lg p-3 text-base focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown resize-y min-h-[300px]"
					autoFocus
				/>
			}
		/>
	);
}

export function AboutPageClient({
	entityType,
	entityId,
	handle,
	aboutContent,
	canEdit,
}: AboutPageClientProps) {
	const router = useRouter();
	const { run: saveProfile } = useAction(saveProfileAction);

	const target: ProfileTarget = entityType === "user" ? { type: "user" } : { type: "page", id: entityId };

	// The action refreshes the page, so the saved text arrives as the `aboutContent` prop.
	const handleSave = async (payload: SavePayload) => {
		const result = await saveProfile({ target, payload });
		if (!result.ok) throw new Error(result.message);
	};

	const handleDeleteAbout = async () => {
		const result = await saveProfile({ target, payload: { fields: { aboutContent: null } } });
		if (!result.ok) throw new Error(result.message);
		router.push(PUBLIC_PROFILE(handle));
	};

	return (
		<InlineEditSession
			resource={{ aboutContent: aboutContent ?? "" } as Record<string, unknown>}
			onSave={handleSave}
			canEdit={canEdit}
		>
			<AboutEditorContent aboutContent={aboutContent} />
			{canEdit && aboutContent && (
				<div className="mt-6 pt-4 border-t border-gray-100">
					<DeleteConfirmButton
						label="Delete"
						itemTitle="about page content"
						onDelete={handleDeleteAbout}
					/>
				</div>
			)}
		</InlineEditSession>
	);
}
