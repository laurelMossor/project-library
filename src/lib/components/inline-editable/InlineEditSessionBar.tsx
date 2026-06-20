"use client";

type InlineEditSessionBarProps = {
	changeCount: number;
	pendingDeleteCount: number;
	saving: boolean;
	error: string | null;
	onSave: () => void;
	onCancel: () => void;
	onUndo: () => void;
	/** True when owner is editing a draft — show the publish affordance. */
	publishable?: boolean;
	/** True when required fields are filled and publish is actually permitted. */
	publishAllowed?: boolean;
	/** Reason shown next to the disabled Publish button when publishAllowed is false. */
	publishHint?: string;
	onPublish?: () => void;
};

/**
 * Sticky save/cancel/publish bar at the bottom of the viewport.
 *
 * Visible when there are unsaved changes OR when the resource is publishable
 * (owner editing a draft) — so a brand-new empty draft always shows the bar
 * with a disabled Publish button and a hint explaining what's missing.
 *
 * Button layout:
 *   Undo (pending deletes) | Cancel | Save  +  Save and publish / Publish
 *
 * "Save and publish" appears when publishable and there are unsaved changes.
 * "Publish" appears when publishable and there are no unsaved changes.
 * When publishAllowed is false both publish buttons are disabled + hint shown.
 */
export function InlineEditSessionBar({
	changeCount,
	pendingDeleteCount,
	saving,
	error,
	onSave,
	onCancel,
	onUndo,
	publishable = false,
	publishAllowed = true,
	publishHint,
	onPublish,
}: InlineEditSessionBarProps) {
	const isVisible = changeCount > 0 || publishable;
	if (!isVisible) return null;

	const hasPendingChanges = changeCount > 0;
	const publishLabel = hasPendingChanges ? "Save and publish" : "Publish";

	return (
		<div className="fixed bottom-0 left-0 right-0 z-50 pointer-events-none">
			<div className="pointer-events-auto">
				{error && (
					<div className="bg-alert-red/10 border-t border-alert-red/30 px-6 py-2 text-center text-sm text-alert-red">
						{error}
					</div>
				)}
				<div className="bg-melon-green/95 backdrop-blur-sm border-t border-rich-brown/20 px-6 py-3 flex items-center justify-between gap-4 shadow-lg">
					{/* Left: change count or empty spacer */}
					<span className="text-sm text-warm-grey">
						{hasPendingChanges
							? changeCount === 1
								? "1 unsaved change"
								: `${changeCount} unsaved changes`
							: null}
					</span>

					{/* Right: action buttons */}
					<div className="flex items-center gap-3">
						{pendingDeleteCount > 0 && (
							<button
								type="button"
								onClick={onUndo}
								disabled={saving}
								className="px-4 py-1.5 text-sm font-medium text-warm-grey hover:text-rich-brown transition-colors disabled:opacity-50"
							>
								Undo
							</button>
						)}

						{hasPendingChanges && (
							<>
								<button
									type="button"
									onClick={onCancel}
									disabled={saving}
									className="px-4 py-1.5 text-sm font-medium text-warm-grey border border-soft-grey rounded-full hover:bg-soft-grey/20 transition-colors disabled:opacity-50"
								>
									Cancel
								</button>
								{/* Save without publishing. When publishable, it's the secondary action
								    (outline) sitting next to Publish; otherwise it's the primary (moss-green). */}
								<button
									type="button"
									onClick={onSave}
									disabled={saving}
									className={`px-5 py-1.5 text-sm font-semibold rounded-full transition-colors disabled:opacity-50 ${
										publishable
											? "text-warm-grey border border-warm-grey/40 hover:bg-soft-grey/20"
											: "text-white bg-moss-green hover:bg-rich-brown"
									}`}
								>
									{saving ? "Saving…" : "Save"}
								</button>
							</>
						)}

						{/* Publish / Save and publish */}
						{publishable && (
							<div className="flex flex-col items-end gap-0.5">
								<button
									type="button"
									onClick={onPublish}
									disabled={saving || !publishAllowed}
									className="px-5 py-1.5 text-sm font-semibold text-white bg-moss-green rounded-full hover:bg-rich-brown transition-colors disabled:opacity-50"
								>
									{saving ? "Saving…" : publishLabel}
								</button>
								{!publishAllowed && publishHint && (
									<span className="text-xs text-warm-grey">{publishHint}</span>
								)}
							</div>
						)}
					</div>
				</div>
			</div>
		</div>
	);
}
