"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createPost } from "@/lib/utils/post-client";
import { AuthError } from "@/lib/utils/auth-client";
import { POST_DETAIL, POST_NEW, LOGIN_WITH_CALLBACK } from "@/lib/const/routes";
import { PostPageShell } from "@/lib/components/layout/PostPageShell";
import { PostContentArea } from "@/lib/components/layout/PostContentArea";
import { TagInputField } from "@/lib/components/inline-editable/TagInputField";
import { ImageUploadModal } from "@/lib/components/ui/ImageUploadModal";
import { TransparentCTAButton } from "@/lib/components/collection/CreationCTA";

type PendingImage = { file: File; preview: string };

const PhotoIcon = () => (
	<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.5}>
		<path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 0 0 1.5-1.5V6a1.5 1.5 0 0 0-1.5-1.5H3.75A1.5 1.5 0 0 0 2.25 6v12a1.5 1.5 0 0 0 1.5 1.5Zm10.5-11.25h.008v.008h-.008V8.25Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
	</svg>
);

export default function NewPostPage() {
	const router = useRouter();
	const [title, setTitle] = useState("");
	const [content, setContent] = useState("");
	const [tagsArr, setTagsArr] = useState<string[]>([]);
	const [pendingImages, setPendingImages] = useState<PendingImage[]>([]);
	const [showImageModal, setShowImageModal] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!content.trim() || submitting) return;

		setSubmitting(true);
		setError("");

		try {
			const post = await createPost({
				title: title.trim() || undefined,
				content: content.trim(),
				tags: tagsArr,
			});

			// Upload and attach any pending images
			for (const { file } of pendingImages) {
				const formData = new FormData();
				formData.append("file", file);
				const uploadRes = await fetch("/api/upload?folder=post-images", {
					method: "POST",
					body: formData,
				});
				if (!uploadRes.ok) continue; // Non-fatal: skip failed images
				const { id: imageId } = await uploadRes.json();
				await fetch("/api/image-attachments", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ imageId, type: "POST", targetId: post.id }),
				});
			}

			router.replace(POST_DETAIL(post.id));
		} catch (err) {
			if (err instanceof AuthError) {
				router.push(LOGIN_WITH_CALLBACK(POST_NEW));
				return;
			}
			setError(err instanceof Error ? err.message : "Failed to create post");
		} finally {
			setSubmitting(false);
		}
	};

	return (
		<>
			<PostPageShell>
				<PostContentArea>
					<form onSubmit={handleSubmit} className="space-y-8">
						{/* Title */}
						<input
							type="text"
							value={title}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Title (optional)"
							maxLength={150}
							className={`w-full text-4xl leading-tight border-none outline-none bg-transparent ${
								title ? "font-bold text-rich-brown" : "font-normal italic text-misty-forest/50"
							}`}
						/>

						{/* Content */}
						<div className={`rounded-lg min-h-[10rem] ${!content ? "bg-melon-green/10 border border-dashed border-ash-green/60" : ""}`}>
							<textarea
								value={content}
								onChange={(e) => setContent(e.target.value)}
								placeholder="What are you working on or thinking about?"
								rows={6}
								maxLength={5000}
								required
								className="w-full h-full text-base leading-relaxed text-gray-700 bg-transparent p-3 border-none outline-none resize-none placeholder:text-misty-forest/60 placeholder:italic"
							/>
						</div>

						{/* Pending image thumbnails */}
						{pendingImages.length > 0 && (
							<div className="flex flex-wrap gap-2">
								{pendingImages.map((img, i) => (
									<div key={i} className="relative">
										<img src={img.preview} alt="" className="w-20 h-20 object-cover rounded" />
										<button
											type="button"
											onClick={() => setPendingImages((prev) => prev.filter((_, j) => j !== i))}
											className="absolute -top-1 -right-1 w-5 h-5 bg-rich-brown text-white rounded-full text-xs flex items-center justify-center hover:bg-novel-red transition-colors"
											aria-label="Remove image"
										>
											×
										</button>
									</div>
								))}
							</div>
						)}

						{/* Attach photos CTA */}
						<TransparentCTAButton
							label="Attach photos"
							icon={<PhotoIcon />}
							onClick={() => setShowImageModal(true)}
						/>

						{/* Tags */}
						<TagInputField
							tags={tagsArr}
							onTagsChange={setTagsArr}
							placeholder="Add topics"
						/>

						{/* Error */}
						{error && <p className="text-sm text-alert-red">{error}</p>}

						{/* Actions */}
						<div className="flex flex-wrap gap-3 items-center pt-4 border-t border-gray-100">
							<button
								type="submit"
								disabled={submitting || !content.trim()}
								className="px-5 py-2 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
							>
								{submitting ? "Posting..." : "Post"}
							</button>
							<button
								type="button"
								onClick={() => router.back()}
								className="px-3 py-1 text-sm font-medium text-warm-grey border border-soft-grey rounded-full hover:bg-soft-grey/20 transition-colors"
							>
								Cancel
							</button>
						</div>
					</form>
				</PostContentArea>
			</PostPageShell>

			<ImageUploadModal
				isOpen={showImageModal}
				onClose={() => setShowImageModal(false)}
				onConfirm={(files) => {
					setPendingImages((prev) => [
						...prev,
						...files.map((f) => ({ file: f, preview: URL.createObjectURL(f) })),
					]);
				}}
			/>
		</>
	);
}
