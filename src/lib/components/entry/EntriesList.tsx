"use client";

import { useEffect, useState } from "react";
import { EntryItem } from "@/lib/types/entry";
import { CollectionType } from "@/lib/types/collection";
import { getEntries } from "@/lib/utils/entry-client";
import { formatDateTime } from "@/lib/utils/datetime";

type EntriesListProps = {
	collectionId: string;
	collectionType: CollectionType;
	showTitle?: boolean;
	maxEntries?: number; // For card view, limit number of entries shown
};

export function EntriesList({ 
	collectionId, 
	collectionType, 
	showTitle = true,
	maxEntries 
}: EntriesListProps) {
	const [entries, setEntries] = useState<EntryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadEntries() {
			try {
				const data = await getEntries(collectionId, collectionType);
				setEntries(data);
			} catch (err) {
				setError("Failed to load entries");
			} finally {
				setLoading(false);
			}
		}
		loadEntries();
	}, [collectionId, collectionType]);

	if (loading) {
		return <div className="text-sm text-gray-500">Loading entries...</div>;
	}

	if (error) {
		return <div className="text-sm text-red-500">{error}</div>;
	}

	if (entries.length === 0) {
		return null;
	}

	const displayEntries = maxEntries ? entries.slice(0, maxEntries) : entries;

	return (
		<div className="mt-6">
			{showTitle && (
				<h3 className="text-lg font-semibold mb-4">Updates</h3>
			)}
			<div className="space-y-4">
				{displayEntries.map((entry) => (
					<div key={entry.id} className="border-l-2 border-soft-grey pl-4 py-2">
						{entry.title && (
							<h4 className="font-medium text-rich-brown mb-1">{entry.title}</h4>
						)}
						<p className="text-sm text-warm-grey whitespace-pre-wrap">{entry.content}</p>
						<p className="text-xs text-gray-400 mt-1">
							{formatDateTime(entry.createdAt)}
						</p>
					</div>
				))}
			</div>
			{maxEntries && entries.length > maxEntries && (
				<p className="text-sm text-gray-500 mt-2">
					+{entries.length - maxEntries} more {entries.length - maxEntries === 1 ? "entry" : "entries"}
				</p>
			)}
		</div>
	);
}

