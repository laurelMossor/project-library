"use client";

import { useRef, useState } from "react";
import { validateImageFile } from "@/lib/utils/image";

type PendingImage = { file: File; preview: string };

type ImageUploadModalProps = {
	isOpen: boolean;
	onClose: () => void;
	/** Called with the chosen files when user confirms. Caller handles upload + attachment. */
	onConfirm: (files: File[]) => void;
};

export function ImageUploadModal({ isOpen, onClose, onConfirm }: ImageUploadModalProps) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	const [pending, setPending] = useState<PendingImage[]>([]);
	const [error, setError] = useState("");

	if (!isOpen) return null;

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files ?? []);
		setError("");
		const valid: PendingImage[] = [];
		for (const file of files) {
			const { valid: ok, error: msg } = validateImageFile(file);
			if (!ok) { setError(msg ?? "Invalid file"); continue; }
			valid.push({ file, preview: URL.createObjectURL(file) });
		}
		setPending((prev) => [...prev, ...valid]);
		// Reset input so same file can be re-selected
		e.target.value = "";
	};

	const remove = (index: number) => {
		setPending((prev) => {
			URL.revokeObjectURL(prev[index].preview);
			return prev.filter((_, i) => i !== index);
		});
	};

	const handleConfirm = () => {
		onConfirm(pending.map((p) => p.file));
		setPending([]);
		onClose();
	};

	const handleClose = () => {
		pending.forEach((p) => URL.revokeObjectURL(p.preview));
		setPending([]);
		setError("");
		onClose();
	};

	return (
		<div
			className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
			onClick={handleClose}
		>
			<div
				className="bg-grey-white rounded-lg p-8 max-w-sm w-full mx-4"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-between items-center mb-6">
					<h2 className="text-xl font-bold text-rich-brown">Attach Photos</h2>
					<button onClick={handleClose} className="text-warm-grey hover:text-rich-brown" aria-label="Close">
						<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 384 512" className="w-5 h-5" fill="currentColor">
							<path d="M324.5 411.1c6.2 6.2 16.4 6.2 22.6 0s6.2-16.4 0-22.6L214.6 256 347.1 123.5c6.2-6.2 6.2-16.4 0-22.6s-16.4-6.2-22.6 0L192 233.4 59.5 100.9c-6.2-6.2-16.4-6.2-22.6 0s-6.2 16.4 0 22.6L169.4 256 36.9 388.5c-6.2 6.2-6.2 16.4 0 22.6s16.4 6.2 22.6 0L192 278.6 324.5 411.1z" />
						</svg>
					</button>
				</div>

				{/* Thumbnail grid */}
				{pending.length > 0 && (
					<div className="flex flex-wrap gap-2 mb-4">
						{pending.map((p, i) => (
							<div key={i} className="relative">
								<img src={p.preview} alt="" className="w-20 h-20 object-cover rounded" />
								<button
									type="button"
									onClick={() => remove(i)}
									className="absolute -top-1 -right-1 w-5 h-5 bg-rich-brown text-white rounded-full text-xs flex items-center justify-center hover:bg-novel-red transition-colors"
									aria-label="Remove"
								>
									×
								</button>
							</div>
						))}
					</div>
				)}

				{error && <p className="text-alert-red text-sm mb-4">{error}</p>}

				<div className="flex flex-col gap-3">
					<input
						ref={fileInputRef}
						type="file"
						accept="image/jpeg,image/png,image/webp"
						multiple
						className="hidden"
						onChange={handleFileChange}
					/>
					<button
						type="button"
						onClick={() => fileInputRef.current?.click()}
						className="w-full py-2 px-4 rounded bg-melon-green text-rich-brown font-semibold hover:shadow-glow-sm transition-shadow"
					>
						Choose photos
					</button>

					{pending.length > 0 && (
						<button
							type="button"
							onClick={handleConfirm}
							className="w-full py-2 px-4 rounded bg-moss-green text-white font-semibold hover:bg-rich-brown transition-colors"
						>
							Add {pending.length} photo{pending.length !== 1 ? "s" : ""}
						</button>
					)}

					<button
						type="button"
						onClick={handleClose}
						className="text-sm text-dusty-grey hover:text-warm-grey text-center"
					>
						Cancel
					</button>
				</div>
			</div>
		</div>
	);
}
