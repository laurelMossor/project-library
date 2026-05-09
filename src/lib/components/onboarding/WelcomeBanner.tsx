"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { PERSONAL_INFO, SEARCH, POST_NEW, ABOUT } from "@/lib/const/routes";
import { XCircleIcon } from "@/lib/components/icons/icons";

const STORAGE_KEY = "pl-welcome-dismissed";

export function WelcomeBanner() {
	const [visible, setVisible] = useState(false);

	useEffect(() => {
		if (!localStorage.getItem(STORAGE_KEY)) {
			setVisible(true);
		}
	}, []);

	if (!visible) return null;

	const dismiss = () => {
		localStorage.setItem(STORAGE_KEY, "1");
		setVisible(false);
	};

	return (
		<div className="mb-6 rounded-lg border border-soft-grey/60 bg-white/70 p-6 relative">
			<button
				onClick={dismiss}
				className="absolute top-3 right-3 text-dusty-grey hover:text-rich-brown transition-colors"
				aria-label="Dismiss"
			>
				<XCircleIcon className="w-5 h-5" />
			</button>

			<h2 className="text-lg font-medium text-rich-brown mb-2">Welcome to the Project Library</h2>
			<p className="text-sm text-warm-grey mb-4">
				A shared space for making, learning, and connecting. Browse what people are working on, share your own projects, or find someone to learn from.
			</p>

			<div className="flex flex-wrap gap-3 mb-4">
				<ActionLink href={ABOUT} label="About the Project Library" />
				<ActionLink href={PERSONAL_INFO} label="Set up your profile" />
				<ActionLink href={SEARCH} label="Find people" />
				<ActionLink href={POST_NEW} label="Post something" />
			</div>

			<p className="text-xs text-dusty-grey">
				This is an early beta — things are still being built. Your feedback shapes what comes next.
			</p>
		</div>
	);
}

function ActionLink({ href, label }: { href: string; label: string }) {
	return (
		<Link
			href={href}
			className="text-sm text-whale-blue hover:underline border border-soft-grey/60 rounded-lg px-3 py-1.5 hover:bg-white transition-colors"
		>
			{label}
		</Link>
	);
}
