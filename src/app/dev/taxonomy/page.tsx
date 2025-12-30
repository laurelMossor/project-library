import { auth } from "@/lib/auth";
import MermaidDiagram from "@/lib/components/mermaid/MermaidDiagram";
import {
	buildMermaidDiagram,
	buildTaxonomyTree,
	loadTaxonomyTopics
} from "@/lib/utils/taxonomy";
import { getUserById } from "@/lib/utils/server/user";
import { redirect } from "next/navigation";

export default async function TaxonomyVisualizerPage() {
	// Middleware protects this route, but we verify session here as a safety check
	const session = await auth();

	if (!session?.user?.id) {
		redirect("/login?callbackUrl=/collection");
	}

	const userId = session.user.id;
	const user = await getUserById(userId);

	if (!user) {
		redirect("/login?callbackUrl=/collection");
	}

	const entries = await loadTaxonomyTopics();
	const tree = buildTaxonomyTree(entries);
	const diagramDefinition = tree.length ? buildMermaidDiagram(tree) : undefined;

	return (
		<main className="space-y-6 px-4 py-8">
			<header className="space-y-2">
				<div className="mx-auto max-w-6xl">
					<h1 className="text-3xl font-semibold">Taxonomy Visualizer</h1>
				</div>
				<p className="text-sm text-slate-500">
					Graphing the public taxonomy so each topic sits under a single ancestor.
				</p>
				<p className="text-xs text-slate-400">
					{entries.length} topics · {tree.length} primary branches
				</p>
			</header>

			<section className="mx-auto w-full max-w-6xl rounded-2xl border border-slate-200 bg-white/80 p-6 shadow-sm">
				<h2 className="text-lg font-medium text-slate-700">Topic tree</h2>
				<p className="text-sm text-slate-500">
					The graph is generated from the CSV under `prisma/seed-data`.
				</p>
				<div className="mt-4">
					{diagramDefinition ? (
						<div className="mx-auto w-full max-w-5xl rounded-xl border border-slate-100 bg-white">
							<MermaidDiagram
								chart={diagramDefinition}
								className="h-[70vh] min-h-[520px] w-full"
							/>
						</div>
					) : (
						<p className="text-sm text-slate-500">No topics were available.</p>
					)}
				</div>
			</section>
		</main>
	);
}