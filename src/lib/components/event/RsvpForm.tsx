"use client";

import { useState } from "react";
import { createRsvp } from "@/lib/utils/event-client";
import { RsvpIdentityChip } from "@/lib/components/event/RsvpIdentityChip";
import type { RsvpStatus } from "@/lib/types/rsvp";
import type { CardUser } from "@/lib/types/card";

type RsvpFormProps = {
	eventId: string;
	onRsvpSubmitted?: () => void;
	/** Anonymous path — pre-filled when logged in but only shown when memberUser is absent. */
	initialName?: string;
	initialEmail?: string;
	existingRsvpStatus?: RsvpStatus;
	initialGuestName?: string | null;
	initialHasPlusOne?: boolean;
	/** When set, the identity chip is the RSVP — no name/email form. */
	memberUser?: CardUser;
};

const STATUS_OPTIONS: { value: RsvpStatus; label: string }[] = [
	{ value: "GOING", label: "Going" },
	{ value: "MAYBE", label: "Maybe" },
	{ value: "CANT_MAKE_IT", label: "Can't make it" },
];

export function RsvpForm({
	eventId,
	onRsvpSubmitted,
	initialName,
	initialEmail,
	existingRsvpStatus,
	initialGuestName,
	initialHasPlusOne,
	memberUser,
}: RsvpFormProps) {
	const [name, setName] = useState(initialName ?? "");
	const [email, setEmail] = useState(initialEmail ?? "");
	const [status, setStatus] = useState<RsvpStatus | null>(existingRsvpStatus ?? null);
	const [bringingPlusOne, setBringingPlusOne] = useState(initialHasPlusOne ?? false);
	const [guestName, setGuestName] = useState(initialGuestName ?? "");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [submitted, setSubmitted] = useState(!!existingRsvpStatus);
	const [submittedStatus, setSubmittedStatus] = useState<RsvpStatus | null>(existingRsvpStatus ?? null);

	const guestsPayload =
		status === "GOING" && bringingPlusOne ? [{ name: guestName.trim() || undefined }] : [];

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!status) return;
		setError("");
		setSubmitting(true);

		try {
			if (memberUser) {
				await createRsvp(eventId, { status, guests: guestsPayload });
			} else {
				await createRsvp(eventId, {
					name: name.trim(),
					email: email.trim(),
					status,
					guests: guestsPayload,
				});
			}
			setSubmittedStatus(status);
			setSubmitted(true);
			onRsvpSubmitted?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit RSVP");
		} finally {
			setSubmitting(false);
		}
	};

	if (submitted && submittedStatus) {
		const statusLabel = STATUS_OPTIONS.find((s) => s.value === submittedStatus)?.label;
		return (
			<div className="rounded-xl border border-melon-green bg-melon-green/10 p-6 text-center">
				<p className="text-lg font-semibold text-moss-green">
					{submittedStatus === "CANT_MAKE_IT"
						? "We'll miss you!"
						: "You're on the list!"}
				</p>
				<p className="mt-1 text-sm text-gray-600">
					Response: <span className="font-medium">{statusLabel}</span>
				</p>
				<button
					type="button"
					onClick={() => setSubmitted(false)}
					className="mt-3 text-sm text-moss-green underline underline-offset-2 hover:text-rich-brown"
				>
					Change response
				</button>
			</div>
		);
	}

	const canSubmit = memberUser
		? !!status && !submitting
		: !!status && !submitting && name.trim().length > 0 && email.trim().length > 0;

	return (
		<form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
			<h3 className="text-lg font-semibold text-rich-brown">RSVP</h3>

			{memberUser ? (
				<RsvpIdentityChip user={memberUser} label="RSVPing as" />
			) : (
				<div className="grid gap-3 sm:grid-cols-2">
					<div>
						<label htmlFor="rsvp-name" className="block text-sm font-medium text-gray-600 mb-1">
							Name
						</label>
						<input
							id="rsvp-name"
							type="text"
							value={name}
							onChange={(e) => setName(e.target.value)}
							placeholder="Your name"
							required
							maxLength={100}
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
						/>
					</div>
					<div>
						<label htmlFor="rsvp-email" className="block text-sm font-medium text-gray-600 mb-1">
							Email
						</label>
						<input
							id="rsvp-email"
							type="email"
							value={email}
							onChange={(e) => setEmail(e.target.value)}
							placeholder="you@example.com"
							required
							className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
						/>
					</div>
				</div>
			)}

			{/* Status selector — no default until the user picks */}
			<div className="flex rounded-lg border border-gray-200 overflow-hidden">
				{STATUS_OPTIONS.map((option) => (
					<button
						key={option.value}
						type="button"
						onClick={() => setStatus(option.value)}
						className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
							status === option.value
								? "bg-rich-brown text-white"
								: "bg-white text-gray-600 hover:bg-gray-50"
						}`}
					>
						{option.label}
					</button>
				))}
			</div>

			{/* Single plus-one */}
			<div className="space-y-2">
				<label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer">
					<input
						type="checkbox"
						checked={bringingPlusOne}
						onChange={(e) => {
							setBringingPlusOne(e.target.checked);
							if (!e.target.checked) setGuestName("");
						}}
						className="rounded border-gray-300 text-rich-brown focus:ring-rich-brown/20"
					/>
					Bringing a +1?
				</label>
				{bringingPlusOne && (
					<div className="flex items-center gap-2 pl-6">
						<input
							type="text"
							value={guestName}
							onChange={(e) => setGuestName(e.target.value)}
							placeholder="Guest name (optional)"
							maxLength={100}
							className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-rich-brown/20 focus:border-rich-brown"
						/>
						<button
							type="button"
							onClick={() => {
								setBringingPlusOne(false);
								setGuestName("");
							}}
							className="text-dusty-grey hover:text-rich-brown px-1"
							aria-label="Remove plus-one"
						>
							×
						</button>
					</div>
				)}
			</div>

			{error && <p className="text-sm text-alert-red">{error}</p>}

			<button
				type="submit"
				disabled={!canSubmit}
				className="w-full py-2.5 text-sm font-semibold text-white bg-rich-brown rounded-lg hover:bg-muted-brown transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{submitting ? "Submitting..." : "Submit RSVP"}
			</button>
		</form>
	);
}
