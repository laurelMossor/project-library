import { MAX_GROUP_NAME_LENGTH } from "@/lib/const/messaging";

/** The optional group-name field, shared by New Group and the Members panel's rename. */
export function GroupNameInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
	return (
		<label className="flex flex-col gap-1">
			<span className="text-[11px] uppercase tracking-wider text-dusty-grey">Group name (optional)</span>
			<input
				value={value}
				onChange={(e) => onChange(e.target.value)}
				// One past the cap so an over-long paste surfaces the validation error rather than silently truncating.
				maxLength={MAX_GROUP_NAME_LENGTH + 1}
				placeholder="e.g. Garden crew"
				className="w-full rounded-lg border border-soft-grey bg-white/60 px-3 py-2 text-sm focus:outline-none focus:border-misty-forest"
			/>
		</label>
	);
}
