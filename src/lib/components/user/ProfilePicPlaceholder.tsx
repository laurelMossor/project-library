import { getInitials } from "@/lib/utils/text";
import { Project } from "@/lib/types/project";
import Link from "next/link";

export const ProfilePicPlaceholder = ({ project }: { project: Project }) => {
    const initials = getInitials(project.owner);
    return (
        <Link 
            href={`/u/${project.owner.username}`}
            className="w-12 h-12 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
        >
            <span className="text-gray-600 font-medium text-sm">{initials}</span>
        </Link>
    );
}