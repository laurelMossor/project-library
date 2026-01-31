import { Tooltip } from "../tooltip/Tooltip";

export function VersionTag() {
	return (
		<Tooltip text="This site is in active development! You may find bugs and incomplete features.">
			<span className="px-2 py-1 bg-whale-blue text-grey-white rounded text-xs font-semibold uppercase">
				ALPHA
			</span>
		</Tooltip>
	);
}

