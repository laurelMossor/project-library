import { readFile } from "node:fs/promises";
import path from "node:path";

const TAXONOMY_CSV_PATH = path.join(
	process.cwd(),
	"prisma",
	"seed-data",
	"Topics Table V1.1.csv"
);

export interface TaxonomyTopicRow {
	topic: string;
	parent?: string;
	descendants: string[];
	synonyms: string[];
}

export interface TaxonomyTreeNode {
	name: string;
	parent?: string;
	children: TaxonomyTreeNode[];
	synonyms: string[];
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

export function parseTaxonomyCsv(csvContent: string): TaxonomyTopicRow[] {
	const lines = csvContent
		.split(/\r?\n/)
		.map((line) => line.trim())
		.filter(Boolean);

	if (lines.length === 0) {
		return [];
	}

	const [_header, ...rows] = lines;

	return rows.map((row) => {
		const [topic, ancestors, descendants, synonyms] = parseCsvLine(row);

		return {
			topic: topic.trim(),
			parent: normalizeField(ancestors),
			descendants: parseMultiValueField(descendants),
			synonyms: parseMultiValueField(synonyms)
		};
	});
}

export async function loadTaxonomyTopics(): Promise<TaxonomyTopicRow[]> {
	const file = await readFile(TAXONOMY_CSV_PATH, "utf8");
	return parseTaxonomyCsv(file);
}

export function buildTaxonomyTree(rows: TaxonomyTopicRow[]): TaxonomyTreeNode[] {
	const nodeMap = new Map<string, TaxonomyTreeNode>();

	const getOrCreateNode = (name: string): TaxonomyTreeNode => {
		const existing = nodeMap.get(name);
		if (existing) {
			return existing;
		}

		const newNode: TaxonomyTreeNode = {
			name,
			children: [],
			synonyms: []
		};

		nodeMap.set(name, newNode);
		return newNode;
	};

	for (const row of rows) {
		const node = getOrCreateNode(row.topic);
		node.synonyms = Array.from(new Set([...node.synonyms, ...row.synonyms]));

		if (row.parent) {
			const parentNode = getOrCreateNode(row.parent);
			if (!parentNode.children.includes(node)) {
				parentNode.children.push(node);
			}
			if (!node.parent) {
				node.parent = row.parent;
			}
		}
	}

	const roots: TaxonomyTreeNode[] = [];

	for (const node of nodeMap.values()) {
		if (!node.parent) {
			roots.push(node);
		}
	}

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

