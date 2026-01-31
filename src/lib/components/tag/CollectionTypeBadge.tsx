import { ProjectItem } from "@/lib/types/project";
import { EventItem } from "@/lib/types/event";

export const CollectionTypeBadge = ({ title }: { title: string }) => {
    const textSize = "text-xs";
    
    return (
        <div className="flex items-center gap-2 mb-1">
            <span className={`${textSize} font-bold px-2 py-1 rounded bg-moss-green text-grey-white uppercase`}>
                {title}
            </span>
        </div>
    );
};
// shadow
// w-full h-auto object-contain rounded shadow-[0_0_15px_rgba(0,0,0,0.12)] hover:shadow-[0_0_28px_rgba(0,0,0,0.22)] transition-shadow

const CollectionTypeBadgeButton = ({ title, selected }: { title: string, selected: boolean }) => {
    const textSize = "text-s";
    const bgColor = selected ? "bg-moss-green" : "bg-misty-forest";
    const textColor = selected ? "text-grey-white" : "text-soft-grey";
    return (
        <div className="flex items-center gap-2 mb-1">
            <span className={`${textSize} font-bold px-2 py-1 rounded ${bgColor} ${textColor} uppercase`}>
                {title}
            </span>
        </div>
    );
};