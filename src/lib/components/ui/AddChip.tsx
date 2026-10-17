import Link from "next/link";

const chipClass =
	"inline-flex items-center gap-1 px-3 py-1 border border-dashed border-ash-green text-misty-forest/70 rounded text-xs";
const interactiveClass = "hover:text-misty-forest hover:border-misty-forest transition-colors cursor-pointer";

type AddChipProps = {
	children: string;
	className?: string;
} & (
	| { href: string; onClick?: never }
	| { onClick: () => void; href?: never }
	| { href?: never; onClick?: never }
);

/**
 * The small dashed "+ label" affordance for adding something that isn't there yet (a tag, a page).
 * A link with `href`, a button with `onClick`, or a plain span when the click belongs to an ancestor
 * (an inline-editable field).
 */
export function AddChip({ children, className = "", href, onClick }: AddChipProps) {
	const label = <>+ {children}</>;
	if (href) {
		return <Link href={href} className={`${chipClass} ${interactiveClass} ${className}`}>{label}</Link>;
	}
	if (onClick) {
		return <button type="button" onClick={onClick} className={`${chipClass} ${interactiveClass} ${className}`}>{label}</button>;
	}
	return <span className={`${chipClass} ${className}`}>{label}</span>;
}
