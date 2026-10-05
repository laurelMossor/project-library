"use client";

import Link from "next/link";
import { COLLECTIONS, MESSAGES, PUBLIC_PROFILE } from "@/lib/const/routes";
import { ModalShell } from "@/lib/components/ui/ModalShell";

const WELCOME_MESSAGE = `The Project Library is about process, not polish. This is a shared space for making, learning, and helping each other along the way. 

It's a place to share what you're working on, see what others are learning, and connect through shared interests. 

You can browse by topic or location, follow what's unfolding, and choose how you explore: no hidden algorithms. If you're working on something, or thinking about starting, you're in the right place.`;

interface AboutModalProps {
	onClose: () => void;
	handle: string | undefined;
}

export function AboutModal({ onClose, handle }: AboutModalProps) {
	return (
		<ModalShell title="About" onClose={onClose} widthClassName="max-w-md">
			<div className="space-y-4">
				<div>
					<p className="text-sm text-warm-grey whitespace-pre-line">
						{WELCOME_MESSAGE}
					</p>
				</div>

				<div>
					<h3 className="font-semibold mb-2">Navigation</h3>
					<nav className="flex flex-col gap-2">
						<Link href={COLLECTIONS} className="text-whale-blue hover:underline">
							Collections
						</Link>
						{handle && (
							<Link href={PUBLIC_PROFILE(handle)} className="text-whale-blue hover:underline">
								Your Profile
							</Link>
						)}
						<Link href={MESSAGES} className="text-whale-blue hover:underline">
							Messages
						</Link>
					</nav>
				</div>
			</div>
		</ModalShell>
	);
}
