"use client";

import { useEffect, useMemo, useRef, useState, type TextareaHTMLAttributes } from "react";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";
import { searchResultEntity } from "@/lib/types/search";
import { resolveCardIdentity, type CardEntity } from "@/lib/types/card";
import { ProfileResultList } from "@/lib/components/search/ProfileResultList";
import { MENTION_BOUNDARY } from "@/lib/utils/mentions";
import { HANDLE_CHARS, HANDLE_MAX_LENGTH } from "@/lib/validations";

type CommentTextAreaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "value" | "onChange"> & {
	value: string;
	onChange: (value: string) => void;
};

/** The `@word` being typed right before the cursor: where its `@` sits and the text after it. */
type ActiveMention = { start: number; query: string };

// Same boundary as the mention parser (so an email or URL never opens the picker), then up to a
// handle's worth of handle characters, ending at the cursor. Group 2 is the query.
const ACTIVE_MENTION = new RegExp(`${MENTION_BOUNDARY}@([${HANDLE_CHARS}]{0,${HANDLE_MAX_LENGTH}})$`, "i");

function activeMentionAt(el: HTMLTextAreaElement): ActiveMention | null {
	const pos = el.selectionStart;
	if (pos !== el.selectionEnd) return null; // a selection, not a cursor
	const match = ACTIVE_MENTION.exec(el.value.slice(0, pos));
	if (!match) return null;
	// A trailing `.`/`-`/`_` is sentence punctuation, not part of a handle (the server parser drops it too):
	// the handle is finished, so there's nothing left to pick. Typing on reopens the picker.
	if (/[._-]$/.test(match[2])) return null;
	return { start: pos - match[2].length - 1, query: match[2] };
}

/**
 * The comment text box — shared by the composer and the inline edit. Typing `@` opens a people-and-pages
 * search under the box; picking a result swaps the `@word` for `@handle `. Plain search only (no invite
 * row). The server decides what's a real tag, so a handle typed out in full works the same as a pick.
 */
export function CommentTextArea({ value, onChange, className = "", onKeyDown, onBlur, ...textareaProps }: CommentTextAreaProps) {
	const ref = useRef<HTMLTextAreaElement>(null);
	const [active, setActive] = useState<ActiveMention | null>(null);
	// Escape closes the popover for this `@word` until the person starts a different one.
	const [dismissedAt, setDismissedAt] = useState<number | null>(null);
	const [focusedIndex, setFocusedIndex] = useState(0);

	const open = active !== null && active.start !== dismissedAt;
	const query = open ? active.query : "";
	const { results: found, loading, debouncedQuery } = useProfileSearch(query, "all");
	const results = useMemo(() => found.map(searchResultEntity), [found]);

	const tooShort = query.length < MIN_SEARCH_LENGTH;
	const pending = !tooShort && (loading || debouncedQuery !== query);
	const showResults = open && !tooShort && !pending && results.length > 0;

	useEffect(() => { setFocusedIndex(0); }, [query]);

	function sync() {
		const el = ref.current;
		if (!el) return;
		const next = activeMentionAt(el);
		setActive(next);
		if (dismissedAt !== null && next?.start !== dismissedAt) setDismissedAt(null);
	}

	function pick(entity: CardEntity) {
		const el = ref.current;
		if (!el || !active) return;
		const insert = `@${resolveCardIdentity(entity).handle} `;
		const cursor = el.selectionStart;
		const next = value.slice(0, active.start) + insert + value.slice(cursor);
		onChange(next);
		setActive(null);
		// Put the cursor right after the inserted handle once React has written the new value.
		const caret = active.start + insert.length;
		requestAnimationFrame(() => {
			el.focus();
			el.setSelectionRange(caret, caret);
		});
	}

	function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
		// Mid-composition keys (Enter confirming a Japanese/Chinese/Korean candidate) belong to the IME.
		if (e.nativeEvent.isComposing) {
			onKeyDown?.(e);
			return;
		}
		if (open && e.key === "Escape") {
			e.preventDefault();
			setDismissedAt(active.start);
			return;
		}
		if (showResults) {
			if (e.key === "ArrowDown") {
				e.preventDefault();
				setFocusedIndex((i) => (i + 1) % results.length);
				return;
			}
			if (e.key === "ArrowUp") {
				e.preventDefault();
				setFocusedIndex((i) => (i - 1 + results.length) % results.length);
				return;
			}
			if ((e.key === "Enter" || e.key === "Tab") && !e.shiftKey) {
				e.preventDefault();
				pick(results[Math.min(focusedIndex, results.length - 1)]);
				return;
			}
		}
		onKeyDown?.(e);
	}

	return (
		<div className="relative">
			<textarea
				{...textareaProps}
				ref={ref}
				value={value}
				onChange={(e) => {
					onChange(e.target.value);
					sync();
				}}
				onSelect={sync}
				onKeyDown={handleKeyDown}
				onBlur={(e) => {
					setActive(null);
					onBlur?.(e);
				}}
				className={className}
				aria-autocomplete="list"
				aria-expanded={showResults}
			/>
			{/* No "No matches" panel: a finished or unknown handle shouldn't leave a box over the Comment button. */}
			{open && (tooShort || pending || showResults) && (
				<div className="absolute z-50 left-0 right-0 -mt-1 border border-soft-grey rounded-lg bg-white shadow-lg overflow-hidden">
					{showResults ? (
						<ProfileResultList
							results={results}
							focusedIndex={focusedIndex}
							onFocusIndex={setFocusedIndex}
							onSelect={pick}
						/>
					) : (
						<p className="px-3 py-2 text-xs text-dusty-grey">
							{tooShort ? "Type a name or handle" : "Searching..."}
						</p>
					)}
				</div>
			)}
		</div>
	);
}
