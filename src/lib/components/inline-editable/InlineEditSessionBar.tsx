"use client";

type InlineEditSessionBarProps = {
	dirtyCount: number;
	saving: boolean;
	error: string | null;
	onSave: () => void;
	onCancel: () => void;
};

/**
 * Sticky save/cancel bar that appears at the bottom of the viewport when an
 * InlineEditSession has unsaved changes. Auto-hides when dirtyCount === 0.
 *
 * Craft note: warm background, subtle top border — feels like a notebook
 * margin note rather than a banner ad.
 */
export function InlineEditSessionBar({
	dirtyCount,
	saving,
	error,
	onSave,
	onCancel,
}: InlineEditSessionBarProps) {
	if (dirtyCount === 0) return null;

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
			<div className="pointer-events-auto">
				{error && (
					<div className="bg-alert-red/10 border-t border-alert-red/30 px-6 py-2 text-center text-sm text-alert-red">
						{error}
					</div>
				)}
				<div className="bg-melon-green/95 backdrop-blur-sm border-t border-rich-brown/20 px-6 py-3 flex items-center justify-between gap-4 shadow-lg">
					<span className="text-sm text-warm-grey">
						{dirtyCount === 1 ? "1 unsaved change" : `${dirtyCount} unsaved changes`}
					</span>
					<div className="flex items-center gap-3">
						<button
							type="button"
							onClick={onCancel}
							disabled={saving}
							className="px-4 py-1.5 text-sm font-medium text-warm-grey border border-soft-grey rounded-full hover:bg-soft-grey/20 transition-colors disabled:opacity-50"
						>
							Cancel
						</button>
						<button
							type="button"
							onClick={onSave}
							disabled={saving}
							className="px-5 py-1.5 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
						>
							{saving ? "Saving…" : "Save"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
