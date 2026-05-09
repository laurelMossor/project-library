"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { CardUser } from "@/lib/types/card";
import { ProfilePicture } from "@/lib/components/profile/ProfilePicture";
import { getCardUserDisplayName } from "@/lib/types/card";
import { useDebounce } from "@/lib/hooks/useDebounce";

export type SearchResultUser = CardUser;

type ProfileSearchDropdownProps = {
	onSelect: (user: SearchResultUser) => void;
	placeholder?: string;
	excludeUserIds?: string[];
	className?: string;
};

export function ProfileSearchDropdown({
	onSelect,
	placeholder = "Search by name or handle...",
	excludeUserIds = [],
	className = "",
}: ProfileSearchDropdownProps) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<SearchResultUser[]>([]);
	const [isLoading, setIsLoading] = useState(false);
	const [isOpen, setIsOpen] = useState(false);
	const [focusedIndex, setFocusedIndex] = useState(-1);

	const containerRef = useRef<HTMLDivElement>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const debouncedQuery = useDebounce(query, 300);

	const fetchResults = useCallback(async (q: string) => {
		if (q.length < 2) {
			setResults([]);
			setIsOpen(false);
			return;
		}

		setIsLoading(true);
		try {
			const res = await fetch(`/api/search/profiles?q=${encodeURIComponent(q)}&type=user`);
			if (!res.ok) throw new Error();
			const data = await res.json();
			const users: SearchResultUser[] = (data.results ?? []).map((r: { id: string; handle: string; name: string; avatarImageId: string | null; avatarImage?: { url: string } | null }) => ({
				id: r.id,
				handle: r.handle,
				displayName: r.name,
				avatarImageId: r.avatarImageId,
				avatarImage: r.avatarImage,
			}));
			const filtered = users.filter(
				(u) => !excludeUserIds.includes(u.id)
			);
			setResults(filtered);
			setIsOpen(true);
		} catch {
			setResults([]);
		} finally {
			setIsLoading(false);
		}
	}, [excludeUserIds]);

	useEffect(() => {
		fetchResults(debouncedQuery);
	}, [debouncedQuery, fetchResults]);

	useEffect(() => {
		function handleClickOutside(e: MouseEvent) {
			if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
				setIsOpen(false);
			}
		}
		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	function handleSelect(user: SearchResultUser) {
		onSelect(user);
		setQuery("");
		setResults([]);
		setIsOpen(false);
		setFocusedIndex(-1);
	}

	function handleKeyDown(e: React.KeyboardEvent) {
		if (e.key === "Escape") {
			setIsOpen(false);
			inputRef.current?.blur();
			return;
		}
		if (!isOpen || results.length === 0) return;

		if (e.key === "ArrowDown") {
			e.preventDefault();
			setFocusedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
		} else if (e.key === "ArrowUp") {
			e.preventDefault();
			setFocusedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
		} else if (e.key === "Enter" && focusedIndex >= 0) {
			e.preventDefault();
			handleSelect(results[focusedIndex]);
		}
	}

	const showHint = query.length > 0 && query.length < 2;
	const showEmpty = isOpen && !isLoading && debouncedQuery.length >= 2 && results.length === 0;
	const showResults = isOpen && results.length > 0;

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
						if (results.length > 0 && debouncedQuery.length >= 2) setIsOpen(true);
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

			{(showResults || showEmpty) && (
				<div className="absolute z-50 left-0 right-0 mt-1 border border-soft-grey rounded-lg bg-white shadow-lg overflow-hidden">
					{showEmpty && (
						<div className="px-3 py-4 text-sm text-dusty-grey text-center">
							No users found
						</div>
					)}
					{showResults && (
						<ul role="listbox" className="py-1">
							{results.map((user, index) => (
								<li
									key={user.id}
									role="option"
									aria-selected={focusedIndex === index}
									onMouseDown={(e) => e.preventDefault()}
									onClick={() => handleSelect(user)}
									onMouseEnter={() => setFocusedIndex(index)}
									className={`flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors ${
										focusedIndex === index
											? "bg-grey-white"
											: "hover:bg-grey-white/60"
									}`}
								>
									<ProfilePicture entity={user} size="sm" asLink={false} />
									<div className="min-w-0">
										<p className="text-sm font-medium text-rich-brown leading-tight truncate">
											{getCardUserDisplayName(user)}
										</p>
										<p className="text-xs text-dusty-grey truncate">
											@{user.handle}
										</p>
									</div>
								</li>
							))}
						</ul>
					)}
				</div>
			)}
		</div>
	);
}
