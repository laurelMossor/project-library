import { Tooltip } from "./Tooltip";

type Props = {
	/** The sentence shown when the mark is hovered or focused. */
	hint: string;
};

/**
 * A small circled question mark. The hint is the accessible name and the tooltip.
 */
export function TellMeMore({ hint }: Props) {
	return (
		<Tooltip text={hint} className="!inline-flex items-center">
			<button
				type="button"
				aria-label={hint}
				className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-dusty-grey/80 text-[10px] font-medium leading-none text-dusty-grey hover:border-rich-brown hover:text-rich-brown"
			>
				<span className="block translate-y-[-0.5px]">?</span>
			</button>
		</Tooltip>
	);
}
