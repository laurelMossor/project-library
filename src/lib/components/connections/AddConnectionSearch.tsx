"use client";

import { useState } from "react";
import { FormInput } from "@/lib/components/forms/FormInput";
import { Button } from "@/lib/components/ui/Button";
import { FormError } from "@/lib/components/forms/FormError";

type AddConnectionSearchProps = {
	onAdd: (userId: string) => Promise<void>;
	placeholder?: string;
	buttonLabel?: string;
	isOpen: boolean;
	onClose: () => void;
};

/**
 * Search component for finding and adding users by username
 */
export function AddConnectionSearch({
	onAdd,
	placeholder = "Enter username",
	buttonLabel = "Add",
	isOpen,
	onClose,
}: AddConnectionSearchProps) {
	const [username, setUsername] = useState("");
	const [adding, setAdding] = useState(false);
	const [error, setError] = useState("");

	if (!isOpen) return null;

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setAdding(true);

		try {
			// First, find user by username
			const userRes = await fetch(`/api/users/by-username/${encodeURIComponent(username.trim())}`);
			if (!userRes.ok) {
				setError("User not found");
				setAdding(false);
				return;
			}

			const userData = await userRes.json();
			await onAdd(userData.id);
			
			setUsername("");
			onClose();
		} catch {
			setError("Failed to add user");
		} finally {
			setAdding(false);
		}
	};

	const handleCancel = () => {
		setUsername("");
		setError("");
		onClose();
	};

	return (
		<div className="border rounded p-4 bg-gray-50 mt-4">
			<form onSubmit={handleSubmit} className="space-y-3">
				<FormError error={error} />
				<div className="flex gap-2">
					<FormInput
						type="text"
						value={username}
						onChange={(e) => setUsername(e.target.value)}
						placeholder={placeholder}
						className="flex-1"
						autoFocus
					/>
					<Button
						type="submit"
						disabled={adding || !username.trim()}
						loading={adding}
						size="sm"
					>
						{buttonLabel}
					</Button>
					<Button
						type="button"
						onClick={handleCancel}
						variant="tertiary"
						size="sm"
						disabled={adding}
					>
						Cancel
					</Button>
				</div>
			</form>
		</div>
	);
}
