import type { ReactNode } from "react";

/** The round "@" stand-in avatar for an email address (no profile behind it, or none we reveal). */
export function AtAvatar() {
	return (
		<span
			aria-hidden
			className="w-8 h-8 shrink-0 rounded-full bg-grey-white border border-soft-grey/60 flex items-center justify-center text-sm font-medium text-misty-forest"
		>
			@
		</span>
	);
}

type EmailInviteTagProps = {
	email: string;
	badge?: ReactNode;
	actions?: ReactNode;
};

/** A pending invite-by-email row, shaped like ProfileTag but showing only the address. */
export function EmailInviteTag({ email, badge, actions }: EmailInviteTagProps) {
	return (
		<div className="flex items-center justify-between text-left px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors">
			<div className="flex items-center gap-3 min-w-0">
				<AtAvatar />
				<p className="text-sm font-medium text-rich-brown leading-tight truncate">{email}</p>
			</div>
			{(badge || actions) && (
				<div className="flex items-center gap-2 shrink-0">
					{badge && (
						typeof badge === "string" ? (
							<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey">
								{badge}
							</span>
						) : badge
					)}
					{actions}
				</div>
			)}
		</div>
	);
}
