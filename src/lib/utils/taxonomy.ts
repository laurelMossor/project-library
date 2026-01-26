import { readFile } from "node:fs/promises";
import path from "node:path";

const TAXONOMY_CSV_PATH = path.join(
	process.cwd(),
	"prisma",
	"seed-data",
	"Topics Table V1.6.csv"
);

export interface TopicNodeRow {
	id: string;
	label: string;
	parentId?: string;
	synonyms?: string[];
}

export interface TaxonomyTreeNode {
	name: string;
	parent?: string;
	children: TaxonomyTreeNode[];
	synonyms: string[];
}

function normalizeTopicKey(name: string): string {
	return name
		.trim()
		.replace(/\s+/g, " ")
		.toLowerCase();
}

function normalizeTopicLabel(name: string): string {
	return name.trim().replace(/\s+/g, " ");
}

function parseCsvLine(line: string): string[] {
	const cells: string[] = [];
	let current = "";
	let inQuotes = false;

	for (let i = 0; i < line.length; i++) {
		const char = line[i];

		if (char === '"' && line[i + 1] === '"') {
			current += '"';
			i++;
			continue;
		}

		if (char === '"') {
			inQuotes = !inQuotes;
			continue;
		}

		if (char === "," && !inQuotes) {
			cells.push(current);
			current = "";
			continue;
		}

		current += char;
	}

	cells.push(current);
	return cells;
}

function normalizeField(value?: string): string | undefined {
	if (!value) {
		return undefined;
	}

	const trimmed = value.trim();
	if (!trimmed || trimmed.toLowerCase() === "null") {
		return undefined;
	}

	return trimmed;
}

function parseMultiValueField(value?: string): string[] {
	const normalized = normalizeField(value);
	if (!normalized) {
		return [];
	}

	return normalized
		.split(",")
		.map((entry) => entry.trim())
		.filter(Boolean);
}

export function parseTaxonomyCsv(csvContent: string): TopicNodeRow[] {
	const lines = csvContent
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		return [];
	}

	const [, ...rows] = lines;
	const topicMap = new Map<string, TopicNodeRow>();
	const parentLabelMap = new Map<string, string>(); // Maps parentId -> original parentLabel

	for (const row of rows) {
		const [topic, ancestors, synonyms] = parseCsvLine(row);

		const label = normalizeTopicLabel(topic);
		const id = normalizeTopicKey(label);
		const parentLabel = normalizeField(ancestors);
		const parentId = parentLabel ? normalizeTopicKey(parentLabel) : undefined;
		const rowSynonyms = parseMultiValueField(synonyms);

		// Track parent labels for creating missing parent nodes
		if (parentLabel && parentId) {
			// Store the first occurrence of each parent label (normalized)
			if (!parentLabelMap.has(parentId)) {
				parentLabelMap.set(parentId, normalizeTopicLabel(parentLabel));
			}
		}

		const existing = topicMap.get(id);
		if (existing) {
			// Merge synonyms if topic appears multiple times
			const mergedSynonyms = Array.from(
				new Set([...(existing.synonyms || []), ...rowSynonyms])
			);
			existing.synonyms = mergedSynonyms.length > 0 ? mergedSynonyms : undefined;
			// Keep the first parentId (first occurrence wins)
		} else {
			topicMap.set(id, {
				id,
				label,
				parentId,
				synonyms: rowSynonyms.length > 0 ? rowSynonyms : undefined
			});
		}
	}

	// Create missing parent nodes
	for (const [parentId, parentLabel] of parentLabelMap.entries()) {
		if (!topicMap.has(parentId)) {
			topicMap.set(parentId, {
				id: parentId,
				label: parentLabel,
				parentId: undefined, // Missing parents are root nodes
				synonyms: undefined
			});
		}
	}

	return Array.from(topicMap.values());
}

export async function loadTaxonomyTopics(): Promise<TopicNodeRow[]> {
	const file = await readFile(TAXONOMY_CSV_PATH, "utf8");
	return parseTaxonomyCsv(file);
}

export function buildTaxonomyTree(rows: TopicNodeRow[]): TaxonomyTreeNode[] {
	// Build a map of nodes by ID for quick lookup
	const nodeMap = new Map<string, TaxonomyTreeNode>();

	// First pass: create all nodes from rows
	for (const row of rows) {
		nodeMap.set(row.id, {
			name: row.label,
			children: [],
			synonyms: row.synonyms || []
		});
	}

	// Second pass: build parent-child relationships
	for (const row of rows) {
		const node = nodeMap.get(row.id);
		if (!node) {
			continue;
		}

		if (row.parentId && row.parentId !== row.id) {
			// Prevent self-cycles
			const parent = nodeMap.get(row.parentId);
			if (parent) {
				node.parent = parent.name;
				parent.children.push(node);
			}
		}
	}

	// Collect root nodes (nodes without parents)
	const roots: TaxonomyTreeNode[] = [];
	for (const node of nodeMap.values()) {
		if (!node.parent) {
			roots.push(node);
		}
	}

	// Sort tree recursively
	const sortChildren = (node: TaxonomyTreeNode) => {
		node.children.sort((a, b) => a.name.localeCompare(b.name));
		node.children.forEach(sortChildren);
	};

	roots.sort((a, b) => a.name.localeCompare(b.name));
	roots.forEach(sortChildren);

	return roots;
}

function escapeLabel(label: string): string {
	return label.replace(/"/g, '\\"');
}

export function buildMermaidDiagram(tree: TaxonomyTreeNode[]): string {
	const lines = ["flowchart TD"];
	const idMap = new Map<string, string>();
	let counter = 0;

	const getId = (name: string) => {
		const existing = idMap.get(name);
		if (existing) {
			return existing;
		}

		const generated = `node${counter++}`;
		idMap.set(name, generated);
		return generated;
	};

	const renderNode = (node: TaxonomyTreeNode) => {
		const nodeId = getId(node.name);
		lines.push(`${nodeId}["${escapeLabel(node.name)}"]`);

		node.children.forEach((child) => {
			const childId = renderNode(child);
			lines.push(`${nodeId} --> ${childId}`);
		});

		return nodeId;
	};

	tree.forEach((root) => renderNode(root));

	return lines.join("\n");
}

