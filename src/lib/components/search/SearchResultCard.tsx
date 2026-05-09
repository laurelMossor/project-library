import Link from "next/link";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { Tag } from "@/lib/components/tag/Tag";
import { PUBLIC_PROFILE } from "@/lib/const/routes";
import type { SearchResultItem } from "@/lib/types/search";

type SearchResultCardProps = {
	result: SearchResultItem;
};

export function SearchResultCard({ result }: SearchResultCardProps) {
	const entity =
		result.type === "page"
			? { id: result.id, handle: result.handle, name: result.name, avatarImageId: result.avatarImageId, avatarImage: result.avatarImage }
			: { id: result.id, handle: result.handle, displayName: result.name, avatarImageId: result.avatarImageId, avatarImage: result.avatarImage };

	return (
		<Link
			href={PUBLIC_PROFILE(result.handle)}
			className="flex items-center gap-4 p-4 border rounded bg-white/70 hover:bg-white hover:shadow-lg transition-shadow"
		>
			<div className="shrink-0">
				<ProfilePicture entity={entity} size="lg" asLink={false} />
			</div>

			<div className="min-w-0 flex-1 flex flex-col gap-1">
				<p className="text-sm font-medium text-rich-brown leading-tight truncate">
					{result.name}
				</p>
				<p className="text-xs text-dusty-grey truncate">@{result.handle}</p>

				{result.headline && (
					<p className="text-xs text-warm-grey line-clamp-2">{result.headline}</p>
				)}

				{result.interests.length > 0 && (
					<div className="flex flex-wrap gap-1 mt-auto">
						{result.interests.slice(0, 3).map((interest) => (
							<Tag key={interest} tag={interest} />
						))}
					</div>
				)}
			</div>
		</Link>
	);
}
