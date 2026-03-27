import { ReactNode } from "react";
import { CardUser, CardPage, getCardUserDisplayName } from "@/lib/types/card";
import { EntityAvatar } from "./EntityAvatar";

type UserModeProps = { user: CardUser; page?: never };
type PageModeProps = { user?: never; page: CardPage };

export type ProfileTagProps = (UserModeProps | PageModeProps) & {
	badge?: string;
	size?: "sm" | "md" | "lg";
	avatarAsLink?: boolean;
	actions?: ReactNode;
	className?: string;
};

export function ProfileTag({
	badge,
	size = "sm",
	avatarAsLink = false,
	actions,
	className = "",
	...entityProps
}: ProfileTagProps) {
	const isUser = "user" in entityProps && entityProps.user !== undefined;
	const name = isUser
		? getCardUserDisplayName(entityProps.user!)
		: entityProps.page!.name;
	const handle = isUser ? entityProps.user!.username : entityProps.page!.slug;

	return (
		<div className={`flex items-center justify-between px-3 py-2.5 rounded-lg border border-soft-grey/60 bg-white/70 hover:bg-white transition-colors ${className}`}>
			<div className="flex items-center gap-3">
				{isUser
					? <EntityAvatar user={entityProps.user!} size={size} asLink={avatarAsLink} />
					: <EntityAvatar page={entityProps.page!} size={size} asLink={avatarAsLink} />
				}
				<div>
					<p className="text-sm font-medium text-rich-brown leading-tight">{name}</p>
					<p className="text-xs text-dusty-grey">@{handle}</p>
				</div>
			</div>
			{(badge || actions) && (
				<div className="flex items-center gap-2">
					{badge && (
						<span className="text-xs px-2 py-0.5 rounded border border-soft-grey/60 text-dusty-grey capitalize">
							{badge}
						</span>
					)}
					{actions}
				</div>
			)}
		</div>
	);
}
