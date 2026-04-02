import Link from "next/link";

const linkClass =
	"flex items-center gap-3 w-full px-4 py-3 text-left text-rich-brown hover:bg-soft-grey rounded transition-colors";

interface MenuItemProps {
	icon: React.ReactNode;
	label: string;
	href?: string;
	onClick?: () => void;
	closeMenu: () => void;
	/** Optional element rendered at the trailing end of the row (e.g. a notification dot) */
	indicator?: React.ReactNode;
}

export function MenuItem({ icon, label, href, onClick, closeMenu, indicator }: MenuItemProps) {
	const handleClick = () => {
		closeMenu();
		onClick?.();
	};

	const content = (
		<>
			{icon}
			<span className="flex-1">{label}</span>
			{indicator}
		</>
	);

	if (href) {
		return (
			<Link href={href} onClick={closeMenu} className={linkClass} role="menuitem">
				{content}
			</Link>
		);
	}

	return (
		<button onClick={handleClick} className={linkClass} role="menuitem">
			{content}
		</button>
	);
}