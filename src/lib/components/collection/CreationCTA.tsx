import { EVENT_NEW } from "@/lib/const/routes"
import { COLLECTION_TYPES, FilterCollectionType } from "@/lib/types/collection"
import Link from "next/link"
import { CalendarIcon } from "../icons/icons"

export const transparentCTAStyles = {
    container: "flex items-center transition-shadow shadow-glow-sm hover:shadow-glow-lg rounded bg-transparent",
    iconWrapper: "p-2 bg-transparent",
    label: "px-2 py-2 text-rich-brown",
};

type TransparentCTAButtonBase = { label: string; icon?: React.ReactNode };
type TransparentCTALinkProps = TransparentCTAButtonBase & { href: string; onClick?: never; disabled?: never };
type TransparentCTAActionProps = TransparentCTAButtonBase & { href?: never; onClick: () => void; disabled?: boolean };
type TransparentCTAButtonProps = TransparentCTALinkProps | TransparentCTAActionProps;

export const TransparentCTAButton = ({ label, icon, ...rest }: TransparentCTAButtonProps) => {
    const inner = (
        <>
            <div className={transparentCTAStyles.iconWrapper}>{icon}</div>
            <span className={transparentCTAStyles.label}>{label}</span>
        </>
    );

    if ("href" in rest && rest.href) {
        return (
            <div className={transparentCTAStyles.container}>
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
            className={`${transparentCTAStyles.container} disabled:opacity-40 disabled:cursor-not-allowed`}
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
