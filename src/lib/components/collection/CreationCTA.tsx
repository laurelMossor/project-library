import { EVENT_NEW, PROJECT_NEW } from "@/lib/const/routes"
import { COLLECTION_TYPES, FilterCollectionType } from "@/lib/types/collection"
import Link from "next/link"
import { CalendarIcon, PencilIcon } from "../icons/icons"

const CTAButton = ({ href, label, icon }: { href: string, label: string, icon?: React.ReactNode }) => {
    const styling = "px-2 py-2  text-rich-brown ";

    return (
        <div className="flex items-center transition-shadow hover:shadow-glow-sm rounded bg-transparent">
            <div className="p-2 bg-transparent">
                {icon}
            </div>
            <Link
                href={href}
                className={styling}
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
                <CTAButton 
                    href={PROJECT_NEW} 
                    label="New Project" 
                    icon={<PencilIcon 
                        className="w-4" />} />
            )}
            {showEventCTA && (
                <CTAButton 
                    href={EVENT_NEW} 
                    label="New Event" 
                    icon={<CalendarIcon
                        className="w-4" />} />
            )}
        </div>
    )
}