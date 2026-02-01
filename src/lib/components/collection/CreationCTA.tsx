import { EVENT_NEW, PROJECT_NEW } from "@/lib/const/routes"
import { COLLECTION_TYPES, FilterCollectionType } from "@/lib/types/collection"
import Link from "next/link"
import { CalendarIcon, PencilIcon } from "../icons/icons"

export const transparentCTAStyles = {
    container: "flex items-center transition-shadow shadow-glow-sm hover:shadow-glow-lg rounded bg-transparent",
    iconWrapper: "p-2 bg-transparent",
    label: "px-2 py-2 text-rich-brown",
};

export const TransparentCTAButton = ({ href, label, icon }: { href: string, label: string, icon?: React.ReactNode }) => {
    return (
        <div className={transparentCTAStyles.container}>
            <div className={transparentCTAStyles.iconWrapper}>
                {icon}
            </div>
            <Link
                href={href}
                className={transparentCTAStyles.label}
            >
                {label}
            </Link>
        </div>
    )
}

export const CreationCTA = ({ collectionTypeFilter }: { collectionTypeFilter: FilterCollectionType }) => {
    const showProjectCTA = collectionTypeFilter === "all" || collectionTypeFilter === COLLECTION_TYPES.PROJECT;
    const showEventCTA = collectionTypeFilter === "all" || collectionTypeFilter === COLLECTION_TYPES.EVENT;
    return (
        <div className="flex justify-center gap-4">  
            {showProjectCTA && (
                <TransparentCTAButton 
                    href={PROJECT_NEW} 
                    label="New Project" 
                    icon={<PencilIcon 
                        className="w-4" />} />
            )}
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