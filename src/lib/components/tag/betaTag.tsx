import { Tooltip } from "../tooltip/Tooltip";

export function BetaTag() {
	return (
		<Tooltip text="This site is in active development!">
			<span className="px-2 py-1 bg-whale-blue text-grey-white rounded text-xs font-semibold uppercase">
				BETA
			</span>
		</Tooltip>
	);
}

