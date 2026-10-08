"use client";

import type { ReactNode } from "react";
import { ModalShell } from "./ModalShell";
import { Button } from "./Button";

type ConfirmModalProps = {
	title: string;
	children: ReactNode;
	confirmLabel: string;
	busy: boolean;
	error: string | null;
	onConfirm: () => void;
	onClose: () => void;
};

/** Account and page deletion. Inline confirms (posts, comments, events) stay on DeleteConfirmButton. */
export function ConfirmModal({ title, children, confirmLabel, busy, error, onConfirm, onClose }: ConfirmModalProps) {
	return (
		<ModalShell title={title} onClose={onClose} dismissible={!busy} widthClassName="max-w-md">
			<div className="space-y-4 text-sm text-warm-grey">
				{children}
				{error && <p role="alert" className="text-sm text-novel-red">{error}</p>}
				<div className="flex justify-end gap-2 pt-1">
					<Button variant="secondary" onClick={onClose} disabled={busy}>Cancel</Button>
					<Button variant="danger-outline" loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
				</div>
			</div>
		</ModalShell>
	);
}
