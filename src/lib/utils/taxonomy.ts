import { readFile } from "node:fs/promises";
import path from "node:path";

const TAXONOMY_CSV_PATH = path.join(
	process.cwd(),
	"prisma",
	"seed-data",
	"Topics Table V1.2.csv"
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

export function parseTaxonomyCsv(csvContent: string): TaxonomyTopicRow[] {
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
	type InternalNode = TaxonomyTreeNode & {
		_key: string;
		_explicitParentKey?: string;
		_inferredParentKeys: Set<string>;
		_childrenKeys: Set<string>;
	};

	const nodeMap = new Map<string, InternalNode>();

	const getOrCreateNode = (rawName: string): InternalNode => {
		const name = normalizeTopicLabel(rawName);
		const key = normalizeTopicKey(name);
		const existing = nodeMap.get(key);
		if (existing) {
			return existing;
		}

		const newNode: InternalNode = {
			_key: key,
			name,
			children: [],
			synonyms: [],
			_inferredParentKeys: new Set<string>(),
			_childrenKeys: new Set<string>()
		};

		nodeMap.set(key, newNode);
		return newNode;
	};

	// 1) Collect nodes + synonyms + parent candidates.
	for (const row of rows) {
		const node = getOrCreateNode(row.topic);
		node.synonyms = Array.from(new Set([...node.synonyms, ...row.synonyms]));

		if (row.parent) {
			const parentNode = getOrCreateNode(row.parent);
			// Explicit parent is the strongest signal; keep the first one we see to stay deterministic.
			node._explicitParentKey ??= parentNode._key;
		}

		// Descendants are child relationships. Many CSV rows won't exist for descendants, so we
		// treat this as a valid way to build the tree.
		for (const descendant of row.descendants) {
			const child = getOrCreateNode(descendant);
			if (child._key === node._key) {
				continue;
			}
			child._inferredParentKeys.add(node._key);
		}
	}

	// 2) Choose a single parent per node:
	// - explicit parent wins
	// - otherwise, if exactly 1 inferred parent exists, use it
	// - otherwise choose a deterministic inferred parent (alphabetical) to keep a tree
	for (const node of nodeMap.values()) {
		const chosenParentKey =
			node._explicitParentKey ??
			(node._inferredParentKeys.size === 1
				? Array.from(node._inferredParentKeys)[0]
				: node._inferredParentKeys.size > 1
					? Array.from(node._inferredParentKeys).sort()[0]
					: undefined);

		if (!chosenParentKey) {
			continue;
		}

		// Prevent trivial self-cycles.
		if (chosenParentKey === node._key) {
			continue;
		}

		const parent = nodeMap.get(chosenParentKey);
		if (!parent) {
			continue;
		}

		node.parent = parent.name;
	}

	// 3) Build children arrays from chosen parents, deduping by canonical key.
	for (const node of nodeMap.values()) {
		if (!node.parent) {
			continue;
		}

		const parentKey = normalizeTopicKey(node.parent);
		const parent = nodeMap.get(parentKey);
		if (!parent) {
			continue;
		}

		if (!parent._childrenKeys.has(node._key)) {
			parent._childrenKeys.add(node._key);
			parent.children.push(node);
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

