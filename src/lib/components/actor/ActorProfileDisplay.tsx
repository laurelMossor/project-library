import { Actor, getActorDisplayName, getActorHeadline, getActorLocation, getActorBio, getActorInterests } from "@/lib/types/actor";
import { Tag } from "../tag";

type ActorProfileDisplayProps = {
	actor: Actor;
};

export function ActorProfileDisplay({ actor }: ActorProfileDisplayProps) {
	const displayName = getActorDisplayName(actor);
	const headline = getActorHeadline(actor);
	const location = getActorLocation(actor);
	const bio = getActorBio(actor);
	const interests = getActorInterests(actor);

	return (
		<div className="flex-1">
			<h1 className="text-3xl font-bold">{displayName}</h1>
			{headline && <p className="text-lg mt-1">{headline}</p>}
			{location && <p className="text-sm text-gray-500 mt-1">{location}</p>}

			{bio && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">About</h2>
					<p className="mt-1">{bio}</p>
				</div>
			)}

			{interests && interests.length > 0 && (
				<div className="mt-6">
					<h2 className="text-sm font-medium text-gray-500">Interests</h2>
					<div className="mt-2 flex flex-wrap gap-2">
						{interests.map((interest) => (
							<Tag key={interest} tag={interest} />
						))}
					</div>
				</div>
			)}
		</div>
	);
}

