import { readFile } from "node:fs/promises";
import path from "node:path";

const TAXONOMY_CSV_PATH = path.join(
	process.cwd(),
	"prisma",
	"seed-data",
	"Topics Table V1.2.csv"
);

export interface TopicNodeRow {
	id: string;          // stable ID (slug/uuid). avoid using the display name as identity
	label: string;       // display name
	parentId?: string;   // undefined/null means root
	synonyms?: string[]; // optional
  }
//   That’s it.
  
//   “Children” are rows.filter(r => r.parentId === id)
  
//   “Descendants” are computed via traversal when needed (or cached/materialized if performance requires later)

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

	return rows.map((row) => {
		const [topic, ancestors, descendants, synonyms] = parseCsvLine(row);

		const label = normalizeTopicLabel(topic);
		const id = normalizeTopicKey(label);
		const parentLabel = normalizeField(ancestors);
		const parentId = parentLabel ? normalizeTopicKey(parentLabel) : undefined;

		return {
			id,
			label,
			parentId,
			synonyms: parseMultiValueField(synonyms)
		};
	});
}

export async function loadTaxonomyTopics(): Promise<TopicNodeRow[]> {
	const file = await readFile(TAXONOMY_CSV_PATH, "utf8");
	return parseTaxonomyCsv(file);
}

export function buildTaxonomyTree(rows: TopicNodeRow[]): TaxonomyTreeNode[] {
	// Build a map of nodes by ID for quick lookup
	const nodeMap = new Map<string, TaxonomyTreeNode>();

	// First pass: create all nodes
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

		if (row.parentId) {
			const parent = nodeMap.get(row.parentId);
			if (parent && row.parentId !== row.id) {
				// Prevent self-cycles
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
		const label = node.synonyms.length
			? `${node.name} (${node.synonyms.join(", ")})`
			: node.name;

		lines.push(`${nodeId}["${escapeLabel(label)}"]`);

		node.children.forEach((child) => {
			const childId = renderNode(child);
			lines.push(`${nodeId} --> ${childId}`);
		});

		return nodeId;
	};

	tree.forEach((root) => renderNode(root));

	return lines.join("\n");
}

