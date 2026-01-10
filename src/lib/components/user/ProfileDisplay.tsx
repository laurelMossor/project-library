import { PublicUser, getUserDisplayName } from "@/lib/types/user";
import { Tag } from "../tag";

type ProfileDisplayProps = {
	user: PublicUser;
};

export function ProfileDisplay({ user }: ProfileDisplayProps) {
	return (
		<div className="flex-1">
			<h1 className="text-3xl font-bold">{getUserDisplayName(user)}</h1>
			{user.headline && <p className="text-lg mt-1">{user.headline}</p>}
			{user.location && <p className="text-sm text-gray-500 mt-1">{user.location}</p>}

			{user.bio && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">About</h2>
					<p className="mt-1">{user.bio}</p>
				</div>
			)}

			{user.interests && user.interests.length > 0 && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">Interests</h2>
					<div className="mt-2 flex flex-wrap gap-2">
						{user.interests.map((interest) => (
							<Tag key={interest} tag={interest} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

