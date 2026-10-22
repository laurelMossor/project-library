"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { CardUser } from "@/lib/types/card";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";
import { ProfileResultList } from "./ProfileResultList";
import { searchResultEntity, type SearchResultItem } from "@/lib/types/search";
import { AtAvatar } from "@/lib/components/profile/EmailInviteTag";
import { identityKey } from "@/lib/const/messaging";

export type SearchResultUser = CardUser;

type ProfileSearchDropdownProps = {
	/** Called with the picked result. The field clears and keeps focus, ready for the next pick. */
	onSelect: (result: SearchResultItem) => void;
	/** Who can be found: people only (default), or people and pages. */
	type?: "user" | "all";
	placeholder?: string;
	/** Results that can't be picked, as `identityKey`s ("user:<id>" / "page:<id>"), e.g. existing members. */
	excludeKeys?: ReadonlySet<string>;
	/** Shown while the field is focused and empty, under `suggestionsLabel`. */
	suggestions?: SearchResultItem[];
	suggestionsLabel?: string;
	/** Nothing more can be picked (e.g. a full group message); `disabledHint` says why. */
	disabled?: boolean;
	disabledHint?: string;
	autoFocus?: boolean;
	className?: string;
	/**
	 * An extra row pinned to the bottom of the list (e.g. "Invite via email"). With it set, the
	 * list opens as soon as the field is focused, before any search. Gets the current query.
	 */
	extraOption?: { label: ReactNode; onSelect: (query: string) => void };
};

/**
 * The one profile picker: type to search, pick from the shared result rows (`ProfileResultList`).
 * Used for page Members (people, with "Invite via email") and for adding people to a group message
 * (people and pages, with connected-people suggestions) via MemberPicker.
 */
export function ProfileSearchDropdown({
	onSelect,
	type = "user",
	placeholder = "Search by name or handle...",
	excludeKeys,
	suggestions = [],
	suggestionsLabel,
	disabled = false,
	disabledHint,
	autoFocus = true,
	className = "",
	extraOption,
}: ProfileSearchDropdownProps) {
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	const [inputFocused, setInputFocused] = useState(false);
	// Suggestions show on an empty, focused field — but not right after a pick, where they'd cover
	// whatever comes next (e.g. a modal's buttons). Clicking the field or clearing it brings them back.
	const [suggestionsOpen, setSuggestionsOpen] = useState(true);
	const [focusedIndex, setFocusedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { results: found, loading: isLoading, debouncedQuery } = useProfileSearch(query, type);
	const searching = debouncedQuery.length >= MIN_SEARCH_LENGTH;
	const showingSuggestions = !query.trim() && inputFocused && suggestionsOpen && suggestions.length > 0;

	// Rows carry both the result (handed to onSelect) and its card entity (drawn by ProfileResultList).
	const rows = useMemo(() => {
		const source = showingSuggestions ? suggestions : found;
		return source
			.filter((r) => !excludeKeys?.has(identityKey(r)))
			.map((item) => ({ item, entity: searchResultEntity(item) }));
	}, [showingSuggestions, suggestions, found, excludeKeys]);

	// Open once a real query's results settle (including "no matches"); close for short queries.
	useEffect(() => {
		if (!searching) setIsOpen(false);
		else if (!isLoading) setIsOpen(true);
	}, [searching, isLoading, found]);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
				setInputFocused(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	function handleSelect(item: SearchResultItem) {
		if (disabled) return;
		onSelect(item);
		setQuery("");
		setIsOpen(false);
		setSuggestionsOpen(false);
		setFocusedIndex(-1);
		inputRef.current?.focus();
	}

	function handleSelectExtra() {
		extraOption?.onSelect(query.trim());
		setIsOpen(false);
		setInputFocused(false);
		setFocusedIndex(-1);
	}

	const showList = (isOpen || showingSuggestions) && rows.length > 0;
	const showExtra = !!extraOption && (isOpen || inputFocused);
	const showHint = !showExtra && query.length > 0 && query.length < MIN_SEARCH_LENGTH;
	const showEmpty = isOpen && !isLoading && searching && rows.length === 0;
	// The extra row sits after the results, at index rows.length.
	const visibleRows = (showList ? rows.length : 0) + (showExtra ? 1 : 0);

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			setIsOpen(false);
			setInputFocused(false);
			inputRef.current?.blur();
			return;
		}
		if (visibleRows === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setFocusedIndex((prev) => (prev < visibleRows - 1 ? prev + 1 : 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setFocusedIndex((prev) => (prev > 0 ? prev - 1 : visibleRows - 1));
		} else if (e.key === "Enter" && focusedIndex >= 0) {
			e.preventDefault();
			if (showList && focusedIndex < rows.length) handleSelect(rows[focusedIndex].item);
			else if (showExtra) handleSelectExtra();
		}
	}

	return (
		<div ref={containerRef} className={`relative ${className}`}>
			<div className="relative">
				<input
					ref={inputRef}
					type="text"
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setFocusedIndex(-1);
						if (!e.target.value.trim()) setSuggestionsOpen(true);
					}}
					onFocus={() => {
						setInputFocused(true);
						if (rows.length > 0 && searching) setIsOpen(true);
					}}
					onClick={() => setSuggestionsOpen(true)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					aria-label={placeholder}
					disabled={disabled}
					className="w-full border border-soft-grey rounded p-2 text-sm focus:outline-none focus:border-dusty-grey transition-colors disabled:opacity-50"
					autoFocus={autoFocus}
					autoComplete="off"
				/>
				{isLoading && (
					<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dusty-grey">
						Searching...
					</span>
				)}
			</div>

			{disabled && disabledHint && <p className="mt-1 text-xs text-novel-red px-1">{disabledHint}</p>}

			{showHint && (
				<div className="mt-1 text-xs text-dusty-grey px-1">
					Type at least 2 characters to search
				</div>
			)}

			{(showList || showEmpty || showExtra) && (
				<div className="absolute z-50 left-0 right-0 mt-1 border border-soft-grey rounded-lg bg-white shadow-lg overflow-hidden">
					{showingSuggestions && showList && suggestionsLabel && (
						<p className="px-3 pt-2 text-[11px] uppercase tracking-wider text-dusty-grey">{suggestionsLabel}</p>
					)}
					{showEmpty && (
						<div className="px-3 py-4 text-sm text-dusty-grey text-center">
							{type === "user" ? "No users found" : "No matches"}
						</div>
					)}
					{showList && (
						<div className="max-h-56 overflow-y-auto">
							<ProfileResultList
								results={rows.map((r) => r.entity)}
								focusedIndex={focusedIndex}
								onFocusIndex={setFocusedIndex}
								onSelect={(entity) => {
									const row = rows.find((r) => r.entity === entity);
									if (row) handleSelect(row.item);
								}}
							/>
						</div>
					)}
					{showExtra && (
						<div
							role="option"
							aria-selected={focusedIndex === (showList ? rows.length : 0)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={handleSelectExtra}
							onMouseEnter={() => setFocusedIndex(showList ? rows.length : 0)}
							className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${showList || showEmpty ? "border-t border-soft-grey/60" : ""} ${
								focusedIndex === (showList ? rows.length : 0)
									? "bg-grey-white"
									: "hover:bg-grey-white/60"
							}`}
						>
							<AtAvatar />
							<p className="text-sm font-medium text-rich-brown leading-tight">{extraOption!.label}</p>
						</div>
					)}
				</div>
			)}
		</div>
	);
}
