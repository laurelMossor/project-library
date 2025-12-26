export interface Tag {
	title: string;
    // childOf?: string;
}

export const Tag = ({ tag }: { tag: string }) => {
	return (
		<div className="px-3 py-1 border bg-melon-green border-soft-grey rounded text-xs">
			{tag}
		</div>
	);
};