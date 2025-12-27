"use client";

import { useEffect, useState } from "react";
import { ProjectEntryItem } from "@/lib/utils/project-entry";
import { fetchProjectEntries } from "@/lib/utils/project-entry-client";
import { ProjectEntryUpdate } from "./ProjectEntryUpdate";

interface ProjectEntriesListProps {
	projectId: string;
}

export const ProjectEntriesList = ({ projectId }: ProjectEntriesListProps) => {
	const [entries, setEntries] = useState<ProjectEntryItem[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");

	useEffect(() => {
		async function loadEntries() {
			try {
				const data = await fetchProjectEntries(projectId);
				setEntries(data);
			} catch (err) {
				setError("Failed to load project entries");
			} finally {
				setLoading(false);
			}
		}
		loadEntries();
	}, [projectId]);

	if (loading) {
		return null; // Don't show anything while loading
	}

	if (error) {
		return null; // Don't show error to user (fail silently)
	}

	if (entries.length === 0) {
		return null; // Don't show anything if no entries
	}

	return (
		<div className="mt-4 pt-4 border-t border-soft-grey">
			<h3 className="font-semibold text-sm mb-3">Project Updates</h3>
			<div className="space-y-4">
				{entries.map((entry) => (
					<ProjectEntryUpdate key={entry.id} entry={entry} />
				))}
			</div>
		</div>
	);
};

