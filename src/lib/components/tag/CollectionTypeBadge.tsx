import { FilterCollectionType } from "@/lib/hooks/useFilter";

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

type CollectionTypeButtonProps = {
    label: string;
    value: FilterCollectionType;
    selected: boolean;
    onClick: (value: FilterCollectionType) => void;
};

export const CollectionTypeButton = ({ label, value, selected, onClick }: CollectionTypeButtonProps) => {
    const bgColor = selected ? "bg-moss-green" : "bg-misty-forest";
    const textColor = selected ? "text-grey-white" : "text-soft-grey";
    return (
        <button
            onClick={() => onClick(value)}
            className={`text-sm font-bold px-2 py-1 rounded ${bgColor} ${textColor} uppercase cursor-pointer transition-shadow hover:shadow-[0_0_12px_rgba(0,0,0,0.25)]`}
            style={{ WebkitAppearance: "none", appearance: "none", border: "none", margin: 0 }}
        >
            {label}
        </button>
    );
};