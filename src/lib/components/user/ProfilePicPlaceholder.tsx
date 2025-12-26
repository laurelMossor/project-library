import { getInitials } from "@/lib/utils/text";
import { PublicUser } from "@/lib/types/user";
import Link from "next/link";

export const ProfilePicPlaceholder = ({ 
	owner, 
	project 
}: { 
	owner?: PublicUser;
	project?: { owner: PublicUser };
}) => {
	const user = owner || project?.owner;
	if (!user) return null;
	
	const initials = getInitials(user);
	return (
		<Link 
			href={`/u/${user.username}`}
			className="w-12 h-12 rounded-full bg-soft-grey flex items-center justify-center flex-shrink-0 hover:opacity-80 transition-opacity"
		>
			<span className="text-gray-600 font-medium text-sm">{initials}</span>
		</Link>
	);
}