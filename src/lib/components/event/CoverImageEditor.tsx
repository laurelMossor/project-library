"use client";

type CoverImageEditorProps = {
	imageUrl?: string | null;
	canEdit: boolean;
	/** Opens the shared ImageEditModal (owned by EventPageClient). */
	onEdit?: () => void;
	/** Opens the full-size viewer when a cover image is present. */
	onOpen?: () => void;
};

/**
 * Cover image area for the event page; purely presentational.
 * Shows a gradient placeholder when no image is set. Clicking the photo opens
 * the lightbox. The overlaid button opens the shared ImageEditModal.
 */
export function CoverImageEditor({ imageUrl, canEdit, onEdit, onOpen }: CoverImageEditorProps) {
	return (
		<div className="relative w-full overflow-hidden rounded-t-lg">
			{imageUrl ? (
				onOpen ? (
					<button
						type="button"
						onClick={onOpen}
						className="block w-full cursor-pointer"
						aria-label="View cover image"
					>
						<img src={imageUrl} alt="Event cover" className="h-80 w-full object-cover" />
					</button>
				) : (
					<img src={imageUrl} alt="Event cover" className="h-80 w-full object-cover" />
				)
			) : (
				<div className="h-80 w-full bg-gradient-to-br from-melon-green via-ash-green to-moss-green" />
			)}

			{canEdit && (
				<button
					type="button"
					onClick={onEdit}
					className="absolute bottom-4 right-4 px-4 py-2 text-sm font-medium bg-white/90 backdrop-blur-sm text-gray-800 rounded-lg shadow-sm hover:bg-white transition-colors"
				>
					{imageUrl ? "Change cover" : "Add cover image"}
				</button>
			)}
		</div>
	);
}
