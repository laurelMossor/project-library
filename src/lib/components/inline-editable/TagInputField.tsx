"use client";

import { useState } from "react";
import { Tag } from "@/lib/components/tag/Tag";
import { toTitleCase } from "@/lib/utils/text";

type TagInputFieldProps = {
	tags: string[];
	onTagsChange: (tags: string[]) => void;
	placeholder?: string;
	maxTags?: number;
};

export function TagInputField({
	tags,
	onTagsChange,
	placeholder = "Type and press Enter",
	maxTags = 10,
}: TagInputFieldProps) {
	const [input, setInput] = useState("");
	const atLimit = tags.length >= maxTags;

	const addTag = (raw: string) => {
		const tag = toTitleCase(raw);
		const isDuplicate = tags.some((t) => t.toLowerCase() === tag.toLowerCase());
		if (!tag || isDuplicate || atLimit) return;
		onTagsChange([...tags, tag]);
		setInput("");
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter" || e.key === ",") {
			e.preventDefault();
			addTag(input);
		} else if (e.key === "Backspace" && input === "" && tags.length > 0) {
			// Remove last tag on backspace when input is empty
			onTagsChange(tags.slice(0, -1));
		}
	};

	return (
		<div className="flex flex-wrap items-center gap-2">
			{tags.map((tag) => (
				<Tag
					key={tag}
					tag={tag}
					onRemove={() => onTagsChange(tags.filter((t) => t !== tag))}
				/>
			))}
			{!atLimit && (
				<input
					type="text"
					value={input}
					onChange={(e) => setInput(e.target.value)}
					onKeyDown={handleKeyDown}
					onBlur={() => addTag(input)}
					placeholder={placeholder}
					className="min-w-[8rem] flex-1 border-b border-ash-green focus:border-rich-brown focus:outline-none text-sm bg-transparent py-0.5 text-warm-grey placeholder:text-misty-forest/50"
				/>
			)}
		</div>
	);
}
