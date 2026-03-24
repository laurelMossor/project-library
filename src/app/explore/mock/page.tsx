"use client";

import { useState, useRef } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventSample = {
	id: string;
	type: "event";
	title: string;
	description: string;
	date: string;
	location: string;
	handle: string;
	initials: string;
};

type PostSample = {
	id: string;
	type: "post";
	badgeLabel: string;
	title: string;
	description: string;
	handle: string;
	initials: string;
	tags: string[];
	hasImage: boolean;
};

type CardItem = EventSample | PostSample;
type ActiveType = "all" | "event" | "post";
type ViewMode = "grid" | "list";

// ─── Sample Data ──────────────────────────────────────────────────────────────

const TOPICS = [
	"Making",
	"Tools",
	"Growing",
	"Learning",
	"Mentorship",
	"Design",
	"Music",
	"Writing",
	"Repair",
];

const ALL_CARDS: CardItem[] = [
	{
		id: "1",
		type: "event",
		title: "Introduction to Hand Tool Woodworking",
		description:
			"Get familiar with chisels, hand planes, and marking gauges. We'll build a small shelf together — no power tools required.",
		date: "SAT APR 5",
		location: "Oakland Tool Library",
		handle: "oaklandtools",
		initials: "OT",
	},
	{
		id: "2",
		type: "post",
		badgeLabel: "In Progress",
		title: "Building a Reclaimed Wood Bookshelf",
		description:
			"Salvaged some Douglas fir from a demo site. Working through joinery options — might do mortise and tenon for the shelves.",
		handle: "miriambuild",
		initials: "MB",
		tags: ["woodworking", "reclaimed"],
		hasImage: true,
	},
	{
		id: "3",
		type: "event",
		title: "Sourdough Bread Baking for Beginners",
		description:
			"Learn starter maintenance and bake your first country loaf. Flour and starter provided — just bring a clean cloth.",
		date: "SUN APR 6",
		location: "The Hearth Kitchen",
		handle: "thehearthkitchen",
		initials: "TH",
	},
	{
		id: "4",
		type: "post",
		badgeLabel: "Seeking Help",
		title: "Learning to Fix My Vintage Singer",
		description:
			"My machine keeps skipping stitches. I've re-threaded it a dozen times. Anyone know tension adjustment on these older models?",
		handle: "rosalopez",
		initials: "RL",
		tags: ["sewing", "repair"],
		hasImage: false,
	},
	{
		id: "5",
		type: "event",
		title: "Bike Repair Drop-In",
		description:
			"Bring your busted bike. Experienced mechanics on hand to help with flats, derailleurs, or brake pads. No appointment needed.",
		date: "WED APR 9",
		location: "Fruitvale Bike Co-op",
		handle: "fruitvalebike",
		initials: "FB",
	},
	{
		id: "6",
		type: "post",
		badgeLabel: "Sharing",
		title: "First Wheel Thrown on My Own",
		description:
			"Six weeks of classes at the community center and I finally centered clay without help. A slightly lopsided bowl still counts.",
		handle: "cjthrowsthings",
		initials: "CJ",
		tags: ["ceramics", "learning"],
		hasImage: false,
	},
];

// ─── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon() {
	return (
		<svg
			width="11"
			height="11"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
			<line x1="16" y1="2" x2="16" y2="6" />
			<line x1="8" y1="2" x2="8" y2="6" />
			<line x1="3" y1="10" x2="21" y2="10" />
		</svg>
	);
}

function PinIcon() {
	return (
		<svg
			width="11"
			height="11"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2.5"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
			<circle cx="12" cy="10" r="3" />
		</svg>
	);
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ card }: { card: EventSample }) {
	return (
		<div className="bg-grey-white border border-soft-grey rounded-lg p-5 flex flex-col gap-3 hover:-translate-y-0.5 hover:border-ash-green transition-all duration-150 cursor-pointer">
			{/* Calendar icon + date — the icon signals "attend this", the date is why you care */}
			<div className="flex items-center justify-between gap-2">
				<span className="text-whale-blue">
					<CalendarIcon />
				</span>
				<span className="text-xs font-semibold text-rich-brown whitespace-nowrap">
					{card.date}
				</span>
			</div>

			<h3 className="text-base font-semibold text-rich-brown leading-snug">
				{card.title}
			</h3>

			<p className="text-sm text-warm-grey leading-relaxed line-clamp-2 flex-1">
				{card.description}
			</p>

			<div className="flex items-center gap-1.5 text-xs text-misty-forest">
				<PinIcon />
				{card.location}
			</div>

			<div className="border-t border-soft-grey pt-3 flex items-center gap-2">
				<div className="w-6 h-6 rounded-full bg-melon-green flex items-center justify-center text-xs font-semibold text-moss-green flex-shrink-0">
					{card.initials}
				</div>
				<span className="text-xs text-warm-grey">@{card.handle}</span>
			</div>
		</div>
	);
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ card }: { card: PostSample }) {
	return (
		// Dashed left border = sketchbook signature, only post cards
		<div
			className="bg-grey-white border border-soft-grey rounded-lg flex flex-col hover:-translate-y-0.5 hover:border-ash-green transition-all duration-150 cursor-pointer overflow-hidden"
			style={{ borderLeft: "2px dashed #C4D6B0" }}
		>
			<div className="p-5 flex flex-col gap-3 flex-1">
				<h3 className="text-base font-semibold text-rich-brown leading-snug">
					{card.title}
				</h3>

				{card.hasImage && (
					<div className="bg-soft-grey rounded h-32 flex items-center justify-center flex-shrink-0">
						<svg
							width="20"
							height="20"
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.5"
							className="text-dusty-grey"
						>
							<rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
							<circle cx="8.5" cy="8.5" r="1.5" />
							<polyline points="21 15 16 10 5 21" />
						</svg>
					</div>
				)}

				<p className="text-sm text-warm-grey leading-relaxed line-clamp-2 flex-1">
					{card.description}
				</p>

				<div className="border-t border-soft-grey pt-3 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2">
						<div className="w-6 h-6 rounded-full bg-melon-green flex items-center justify-center text-xs font-semibold text-moss-green flex-shrink-0">
							{card.initials}
						</div>
						<span className="text-xs text-warm-grey">@{card.handle}</span>
					</div>
					<div className="flex gap-1 flex-wrap justify-end">
						{card.tags.map((tag) => (
							<span
								key={tag}
								className="bg-melon-green/30 text-moss-green text-xs rounded-full px-2 py-0.5"
							>
								{tag}
							</span>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}

// ─── Skeleton Card ────────────────────────────────────────────────────────────

function SkeletonCard() {
	return (
		<div className="bg-grey-white border border-soft-grey rounded-lg p-5 flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<div className="h-4 w-20 bg-soft-grey rounded animate-pulse" />
				<div className="h-4 w-14 bg-soft-grey rounded animate-pulse" />
			</div>
			<div className="h-5 w-3/4 bg-soft-grey rounded animate-pulse" />
			<div className="flex flex-col gap-1.5 flex-1">
				<div className="h-3.5 w-full bg-soft-grey rounded animate-pulse" />
				<div className="h-3.5 w-5/6 bg-soft-grey rounded animate-pulse" />
			</div>
			<div className="h-3 w-1/3 bg-soft-grey rounded animate-pulse" />
			<div className="border-t border-soft-grey pt-3 flex items-center gap-2">
				<div className="w-6 h-6 rounded-full bg-soft-grey animate-pulse flex-shrink-0" />
				<div className="h-3 w-24 bg-soft-grey rounded animate-pulse" />
			</div>
		</div>
	);
}

// ─── Empty State ──────────────────────────────────────────────────────────────

function EmptyState() {
	return (
		<div className="flex flex-col items-center justify-center py-24 text-center">
			<div className="w-10 h-10 rounded-full bg-soft-grey flex items-center justify-center mb-5">
				<PinIcon />
			</div>
			<p className="text-lg font-semibold text-rich-brown mb-1.5">
				Nothing pinned here yet.
			</p>
			<p className="text-sm text-warm-grey mb-8 max-w-xs">
				Change your topic or search term — or add something to the board.
			</p>
			<div className="flex gap-3">
				<button className="px-4 py-2 text-sm border border-rich-brown text-rich-brown rounded-md hover:bg-grey-white transition-colors">
					Share a project
				</button>
				<button className="px-4 py-2 text-sm bg-rich-brown text-grey-white rounded-md hover:opacity-90 transition-opacity">
					Post an event
				</button>
			</div>
		</div>
	);
}

// ─── Search with Typeahead ────────────────────────────────────────────────────

function SearchBox({
	selectedTopics,
	onSelectTopic,
}: {
	selectedTopics: string[];
	onSelectTopic: (topic: string) => void;
}) {
	const [value, setValue] = useState("");
	const [open, setOpen] = useState(false);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const suggestions = value.trim()
		? TOPICS.filter(
				(t) =>
					t.toLowerCase().includes(value.toLowerCase()) &&
					!selectedTopics.includes(t)
		  )
		: [];

	const handleSelect = (topic: string) => {
		onSelectTopic(topic);
		setValue("");
		setOpen(false);
	};

	return (
		<div className="relative w-full max-w-lg">
			<input
				type="text"
				value={value}
				onChange={(e) => {
					setValue(e.target.value);
					setOpen(true);
				}}
				onFocus={() => setOpen(true)}
				onBlur={() => {
					// Delay so click on suggestion registers first
					blurTimer.current = setTimeout(() => setOpen(false), 150);
				}}
				placeholder="Search workshops, projects, people..."
				className="w-full bg-grey-white border border-soft-grey rounded-md px-4 py-2.5 text-sm text-rich-brown placeholder:text-dusty-grey focus:outline-none focus:border-misty-forest transition-colors"
			/>

			{/* Topic suggestions dropdown */}
			{open && suggestions.length > 0 && (
				<div className="absolute top-full left-0 right-0 mt-1 bg-grey-white border border-soft-grey rounded-md shadow-sm overflow-hidden z-10">
					<div className="px-3 pt-2 pb-1">
						<span className="text-[10px] uppercase tracking-widest text-dusty-grey font-medium">
							Topics
						</span>
					</div>
					{suggestions.map((topic) => (
						<button
							key={topic}
							onMouseDown={() => handleSelect(topic)}
							className="w-full text-left px-3 py-2 text-sm text-warm-grey hover:bg-soft-grey hover:text-rich-brown flex items-center gap-2 transition-colors"
						>
							<span className="w-1.5 h-1.5 rounded-full bg-melon-green flex-shrink-0" />
							{topic}
						</button>
					))}
				</div>
			)}
		</div>
	);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ExploreMockPage() {
	const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
	const [activeType, setActiveType] = useState<ActiveType>("all");
	const [view, setView] = useState<ViewMode>("grid");
	const [isLoading, setIsLoading] = useState(false);
	const [isEmpty, setIsEmpty] = useState(false);

	const toggleTopic = (topic: string) =>
		setSelectedTopics((prev) =>
			prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
		);

	const visibleCards = isEmpty
		? []
		: ALL_CARDS.filter((c) => activeType === "all" || c.type === activeType);

	const columnsClass =
		view === "grid"
			? "columns-1 md:columns-2 lg:columns-3 gap-5"
			: "columns-1 max-w-2xl";

	return (
		<div className="min-h-screen bg-soft-grey">
			{/* Demo controls */}
			<div className="bg-rich-brown text-grey-white text-xs px-6 py-2 flex items-center gap-4">
				<span className="text-grey-white/40 uppercase tracking-widest text-[10px] font-medium">
					Mock
				</span>
				<button
					onClick={() => setIsLoading((v) => !v)}
					className="px-2.5 py-0.5 rounded border border-grey-white/20 text-grey-white/70 hover:bg-grey-white/10 transition-colors"
				>
					{isLoading ? "Hide skeleton" : "Show skeleton"}
				</button>
				<button
					onClick={() => setIsEmpty((v) => !v)}
					className="px-2.5 py-0.5 rounded border border-grey-white/20 text-grey-white/70 hover:bg-grey-white/10 transition-colors"
				>
					{isEmpty ? "Hide empty state" : "Show empty state"}
				</button>
			</div>

			{/* Header zone */}
			<div className="bg-ash-green px-6 py-5">
				<div className="max-w-6xl mx-auto">
					<h1 className="text-2xl font-bold tracking-tight text-rich-brown mb-0.5">
						Explore
					</h1>
					<p className="text-sm text-misty-forest mb-4">
						See what your community is making and sharing
					</p>
					<SearchBox
						selectedTopics={selectedTopics}
						onSelectTopic={toggleTopic}
					/>
					{/* Selected topic chips — visible confirmation of active filters */}
					{selectedTopics.length > 0 && (
						<div className="flex flex-wrap gap-2 mt-3">
							{selectedTopics.map((topic) => (
								<button
									key={topic}
									onClick={() => toggleTopic(topic)}
									className="inline-flex items-center gap-1.5 bg-melon-green text-rich-brown text-xs font-medium px-2.5 py-1 rounded-full hover:bg-melon-green/70 transition-colors"
								>
									{topic}
									<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
										<line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
									</svg>
								</button>
							))}
						</div>
					)}
				</div>
			</div>

			<div className="max-w-6xl mx-auto px-6 py-6">
				{/* Topic tabs — curated interest areas, not raw tags */}
				<div className="mb-5 flex items-center gap-3 overflow-x-auto pb-px">
					<span className="text-xs text-dusty-grey whitespace-nowrap flex-shrink-0 font-medium">
						Topics:
					</span>
					{TOPICS.map((topic) => {
						const active = selectedTopics.includes(topic);
						return (
							<button
								key={topic}
								onClick={() => toggleTopic(topic)}
								className={`flex-shrink-0 px-3 py-1.5 text-sm rounded-sm transition-all duration-100 whitespace-nowrap ${
									active
										? "bg-grey-white text-rich-brown font-semibold border-t-2 border-rich-brown"
										: "bg-soft-grey/70 text-warm-grey hover:bg-grey-white/60 hover:text-rich-brown"
								}`}
							>
								{topic}
							</button>
						);
					})}
				</div>

				{/* Filter bar */}
				<div className="flex items-center justify-between py-3 border-b border-soft-grey mb-6">
					<div className="flex items-center gap-1.5">
						{(
							[
								["all", "All"],
								["event", "Events"],
								["post", "Posts"],
							] as [ActiveType, string][]
						).map(([type, label]) => (
							<button
								key={type}
								onClick={() => setActiveType(type)}
								className={`px-3 py-1 text-sm rounded-full transition-colors ${
									activeType === type
										? "bg-rich-brown text-grey-white"
										: "border border-soft-grey text-warm-grey hover:border-misty-forest hover:text-rich-brown"
								}`}
							>
								{label}
							</button>
						))}
					</div>

					<div className="flex items-center gap-4">
						<div className="relative">
							<select className="text-sm text-warm-grey bg-transparent focus:outline-none cursor-pointer appearance-none pr-4">
								<option>Newest</option>
								<option>Oldest</option>
								<option>Relevance</option>
							</select>
							<svg
								className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none text-dusty-grey"
								width="10"
								height="10"
								viewBox="0 0 24 24"
								fill="none"
								stroke="currentColor"
								strokeWidth="2.5"
							>
								<polyline points="6 9 12 15 18 9" />
							</svg>
						</div>
						<div className="flex items-center gap-0.5">
							<button
								onClick={() => setView("list")}
								className={`p-1.5 rounded transition-colors ${view === "list" ? "text-rich-brown" : "text-dusty-grey hover:text-warm-grey"}`}
								title="List view"
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
									<line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
								</svg>
							</button>
							<button
								onClick={() => setView("grid")}
								className={`p-1.5 rounded transition-colors ${view === "grid" ? "text-rich-brown" : "text-dusty-grey hover:text-warm-grey"}`}
								title="Grid view"
							>
								<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
									<rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
								</svg>
							</button>
						</div>
					</div>
				</div>

				{/* Content */}
				{isLoading ? (
					<div className={columnsClass}>
						{Array.from({ length: 6 }).map((_, i) => (
							<div key={i} className="break-inside-avoid mb-5">
								<SkeletonCard />
							</div>
						))}
					</div>
				) : visibleCards.length === 0 ? (
					<EmptyState />
				) : (
					<div className={columnsClass}>
						{visibleCards.map((card) => (
							<div key={card.id} className="break-inside-avoid mb-5">
								{card.type === "event" ? (
									<EventCard card={card} />
								) : (
									<PostCard card={card} />
								)}
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
}
