"use client";

import { useState } from "react";
import { createRsvp } from "@/lib/utils/event-client";
import type { RsvpStatus } from "@/lib/types/rsvp";

type RsvpFormProps = {
	eventId: string;
	onRsvpSubmitted?: () => void;
};

const STATUS_OPTIONS: { value: RsvpStatus; label: string }[] = [
	{ value: "GOING", label: "Going" },
	{ value: "MAYBE", label: "Maybe" },
	{ value: "CANT_MAKE_IT", label: "Can't make it" },
];

export function RsvpForm({ eventId, onRsvpSubmitted }: RsvpFormProps) {
	const [name, setName] = useState("");
	const [email, setEmail] = useState("");
	const [status, setStatus] = useState<RsvpStatus>("GOING");
	const [submitting, setSubmitting] = useState(false);
	const [error, setError] = useState("");
	const [submitted, setSubmitted] = useState(false);
	const [submittedStatus, setSubmittedStatus] = useState<RsvpStatus | null>(null);

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setError("");
		setSubmitting(true);

		try {
			await createRsvp(eventId, {
				name: name.trim(),
				email: email.trim(),
				status,
			});
			setSubmittedStatus(status);
			setSubmitted(true);
			onRsvpSubmitted?.();
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to submit RSVP");
		} finally {
			setSubmitting(false);
		}
	};

	if (submitted) {
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

	return (
		<form onSubmit={handleSubmit} className="rounded-xl border border-gray-200 bg-white p-6 space-y-4">
			<h3 className="text-lg font-semibold text-rich-brown">RSVP</h3>

			{/* Status selector */}
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

			{/* Name and email */}
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

			{error && <p className="text-sm text-alert-red">{error}</p>}

			<button
				type="submit"
				disabled={submitting || !name.trim() || !email.trim()}
				className="w-full py-2.5 text-sm font-semibold text-white bg-rich-brown rounded-lg hover:bg-muted-brown transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
			>
				{submitting ? "Submitting..." : "Submit RSVP"}
			</button>
		</form>
	);
}
