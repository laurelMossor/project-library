import { EVENT_NEW } from "@/lib/const/routes"
import { COLLECTION_TYPES, FilterCollectionType } from "@/lib/types/collection"
import Link from "next/link"
import { CalendarIcon } from "../icons/icons"

export const transparentCTAStyles = {
    container: "flex items-center transition-shadow shadow-glow-sm hover:shadow-glow-lg rounded bg-transparent",
    md: { iconWrapper: "p-2 bg-transparent", label: "px-2 py-2 text-rich-brown" },
    /** Same height as an interest tag: text-xs, py-1. */
    sm: { iconWrapper: "py-1 pl-2 pr-0.5 bg-transparent", label: "py-1 pr-2.5 text-xs text-rich-brown" },
};

type TransparentCTAButtonBase = {
    label: string;
    icon?: React.ReactNode;
    className?: string;
    /** "sm" matches an interest tag. "md" is the profile-page size. */
    size?: "sm" | "md";
};
type TransparentCTALinkProps = TransparentCTAButtonBase & { href: string; onClick?: never; disabled?: never };
type TransparentCTAActionProps = TransparentCTAButtonBase & { href?: never; onClick: () => void; disabled?: boolean };
type TransparentCTAButtonProps = TransparentCTALinkProps | TransparentCTAActionProps;

export const TransparentCTAButton = ({ label, icon, className = "", size = "md", ...rest }: TransparentCTAButtonProps) => {
    const styles = transparentCTAStyles[size];
    const inner = (
        <>
            <div className={styles.iconWrapper}>{icon}</div>
            <span className={styles.label}>{label}</span>
        </>
    );

    if ("href" in rest && rest.href) {
        return (
            <div className={`${transparentCTAStyles.container} ${className}`}>
                <Link href={rest.href} className="flex items-center">
                    {inner}
                </Link>
            </div>
        );
    }

    const { onClick, disabled } = rest as TransparentCTAActionProps;
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className={`${transparentCTAStyles.container} disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
        >
            {inner}
        </button>
    );
}

export const CreationCTA = ({ collectionTypeFilter }: { collectionTypeFilter: FilterCollectionType }) => {
    const showEventCTA = collectionTypeFilter === "all" || collectionTypeFilter === COLLECTION_TYPES.EVENT;
    return (
        <div className="flex justify-center gap-4">
            {showEventCTA && (
                <TransparentCTAButton
                    href={EVENT_NEW}
                    label="New Event"
                    icon={<CalendarIcon
                        className="w-4" />} />
            )}
        </div>
    )
}
