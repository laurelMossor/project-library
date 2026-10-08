"use client";

import { useState } from "react";
import { DropdownMenu } from "@/lib/components/ui/DropdownMenu";
import { formatRole } from "@/lib/const/roles";

const ROLE_CHIP =
	"text-xs px-2 py-0.5 rounded border border-soft-grey/60 bg-white text-dusty-grey";

// Role selector rendered as the same chip the row's role badge uses, so changing a
// role doesn't look like one of the action buttons next to it.
export function RoleSelector({
	current,
	roles,
	onChange,
}: {
	current: string;
	roles: readonly string[];
	onChange: (role: string) => Promise<void>;
}) {
	const [open, setOpen] = useState(false);
	return (
		<DropdownMenu
			isOpen={open}
			onClose={() => setOpen(!open)}
			triggerAriaLabel="Change role"
			triggerClassName={`${ROLE_CHIP} hover:border-misty-forest transition-colors cursor-pointer whitespace-nowrap`}
			trigger={<span>{formatRole(current)} ▾</span>}
			containerClassName="min-w-[140px]"
		>
			{roles.map((role) => (
				<button
					key={role}
					role="menuitem"
					onClick={async () => {
						setOpen(false);
						if (role !== current) await onChange(role);
					}}
					className="w-full text-left px-3 py-1.5 hover:bg-soft-grey/20 transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rich-brown/20"
				>
					<span className={`${ROLE_CHIP} ${role === current ? "border-moss-green text-rich-brown" : ""}`}>
						{formatRole(role)}
					</span>
				</button>
			))}
		</DropdownMenu>
	);
}

