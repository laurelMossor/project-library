import Link from "next/link";

const linkClass =
	"flex items-center gap-3 w-full px-4 py-3 text-left text-rich-brown hover:bg-soft-grey rounded transition-colors";



interface MenuItemProps {
	icon: React.ReactNode;
	label: string;
	href?: string;
	onClick?: () => void;
	closeMenu: () => void;
}

export function MenuItem({ icon, label, href, onClick, closeMenu }: MenuItemProps) {
	const handleClick = () => {
		closeMenu();
		onClick?.();
	};

	if (href) {
		return (
			<Link
				href={href}
				onClick={closeMenu}
				className={linkClass}
				role="menuitem"
			>
				{icon}
				<span>{label}</span>
			</Link>
		);
	}

	return (
		<button
			onClick={handleClick}
			className={linkClass}
			role="menuitem"
		>
			{icon}
			<span>{label}</span>
		</button>
	);
}