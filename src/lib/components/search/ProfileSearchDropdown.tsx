"use client";

import { useState, useEffect, useRef, useMemo, type ReactNode } from "react";
import { CardUser } from "@/lib/types/card";
import { MIN_SEARCH_LENGTH, useProfileSearch } from "@/lib/hooks/useProfileSearch";
import { ProfileResultList } from "./ProfileResultList";
import { searchResultUser } from "@/lib/types/search";
import { AtAvatar } from "@/lib/components/profile/EmailInviteTag";

export type SearchResultUser = CardUser;

type ProfileSearchDropdownProps = {
	onSelect: (user: SearchResultUser) => void;
	placeholder?: string;
	excludeUserIds?: string[];
	className?: string;
	/**
	 * An extra row pinned to the bottom of the list (e.g. "Invite via email"). With it set, the
	 * list opens as soon as the field is focused, before any search. Gets the current query.
	 */
	extraOption?: { label: ReactNode; onSelect: (query: string) => void };
};

export function ProfileSearchDropdown({
	onSelect,
	placeholder = "Search by name or handle...",
	excludeUserIds = [],
	className = "",
	extraOption,
}: ProfileSearchDropdownProps) {
	const [query, setQuery] = useState("");
	const [isOpen, setIsOpen] = useState(false);
	// Only tracked for `extraOption`, which shows while the field is focused even with no query.
	const [inputFocused, setInputFocused] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);

	const { results: found, loading: isLoading, debouncedQuery } = useProfileSearch(query, "user");
	const results = useMemo(
		() => found.map(searchResultUser).filter((u) => !excludeUserIds.includes(u.id)),
		[found, excludeUserIds],
	);

	// Open once a real query's results settle (including "no users found"); close for short queries.
	useEffect(() => {
		if (debouncedQuery.length < MIN_SEARCH_LENGTH) setIsOpen(false);
		else if (!isLoading) setIsOpen(true);
	}, [debouncedQuery, isLoading, found]);

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

	function handleSelect(user: SearchResultUser) {
		onSelect(user);
		setQuery("");
		setIsOpen(false);
		setFocusedIndex(-1);
	}

	function handleSelectExtra() {
		extraOption?.onSelect(query.trim());
		setIsOpen(false);
		setInputFocused(false);
		setFocusedIndex(-1);
	}

	const showExtra = !!extraOption && (isOpen || inputFocused);
	const showHint = !showExtra && query.length > 0 && query.length < MIN_SEARCH_LENGTH;
	const showEmpty = isOpen && !isLoading && debouncedQuery.length >= MIN_SEARCH_LENGTH && results.length === 0;
	const showResults = isOpen && results.length > 0;
	// The extra row sits after the results, at index results.length.
	const visibleRows = (showResults ? results.length : 0) + (showExtra ? 1 : 0);

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
			if (showResults && focusedIndex < results.length) handleSelect(results[focusedIndex]);
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
					}}
					onFocus={() => {
						setInputFocused(true);
						if (results.length > 0 && debouncedQuery.length >= MIN_SEARCH_LENGTH) setIsOpen(true);
					}}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					className="w-full border border-soft-grey rounded p-2 text-sm focus:outline-none focus:border-dusty-grey transition-colors"
					autoFocus
					autoComplete="off"
				/>
				{isLoading && (
					<span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-dusty-grey">
						Searching...
					</span>
				)}
			</div>

			{showHint && (
				<div className="mt-1 text-xs text-dusty-grey px-1">
					Type at least 2 characters to search
				</div>
			)}

			{(showResults || showEmpty || showExtra) && (
				<div className="absolute z-50 left-0 right-0 mt-1 border border-soft-grey rounded-lg bg-white shadow-lg overflow-hidden">
					{showEmpty && (
						<div className="px-3 py-4 text-sm text-dusty-grey text-center">
							No users found
						</div>
					)}
					{showResults && (
						<ProfileResultList
							results={results}
							focusedIndex={focusedIndex}
							onFocusIndex={setFocusedIndex}
							onSelect={handleSelect}
						/>
					)}
					{showExtra && (
						<div
							role="option"
							aria-selected={focusedIndex === (showResults ? results.length : 0)}
							onMouseDown={(e) => e.preventDefault()}
							onClick={handleSelectExtra}
							onMouseEnter={() => setFocusedIndex(showResults ? results.length : 0)}
							className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${showResults || showEmpty ? "border-t border-soft-grey/60" : ""} ${
								focusedIndex === (showResults ? results.length : 0)
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
