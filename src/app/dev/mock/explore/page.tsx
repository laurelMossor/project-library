"use client";

import { useState, useRef } from "react";
import Masonry from "react-masonry-css";

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
		title: "",
		description:
			"Salvaged some Douglas fir from a demo site. Working through joinery options — might do mortise and tenon for the shelves. The grain on this wood is incredible, worth the extra effort to show it off.",
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
		title: "First Wheel Thrown on My Own",
		description:
			"Six weeks of classes at the community center and I finally centered clay without help. A slightly lopsided bowl still counts.",
		handle: "cjthrowsthings",
		initials: "CJ",
		tags: ["ceramics", "learning"],
		hasImage: false,
	},
	{
		id: "7",
		type: "event",
		title: "Seed Saving and Soil Health",
		description:
			"A casual evening talk on saving seeds from your garden and building soil biology without synthetic inputs. Q&A after.",
		date: "THU APR 10",
		location: "Temescal Branch Library",
		handle: "urbangrowcollective",
		initials: "UG",
	},
	{
		id: "8",
		type: "post",
		title: "Converted a Broken Dresser into a Tool Chest",
		description:
			"Found this mid-century dresser on the curb with a cracked top. Replaced the surface with plywood, added dividers, and lined the drawers with felt. Holds all my hand tools now.",
		handle: "nolansworkshop",
		initials: "NW",
		tags: ["furniture", "upcycling", "tools"],
		hasImage: true,
	},
];

const MASONRY_BREAKPOINTS = {
	default: 3,
	1024: 2,
	640: 1,
};

// ─── Icons ────────────────────────────────────────────────────────────────────

function CalendarIcon() {
	return (
		<svg
			width="12"
			height="12"
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
			width="12"
			height="12"
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

function SearchIcon() {
	return (
		<svg
			width="16"
			height="16"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="text-dusty-grey"
		>
			<circle cx="11" cy="11" r="8" />
			<line x1="21" y1="21" x2="16.65" y2="16.65" />
		</svg>
	);
}

function ImagePlaceholderIcon() {
	return (
		<svg
			width="24"
			height="24"
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
	);
}

// ─── Event Card ───────────────────────────────────────────────────────────────

function EventCard({ card }: { card: EventSample }) {
	return (
		<div className="group bg-grey-white border border-soft-grey rounded-lg overflow-hidden flex flex-col hover:-translate-y-0.5 hover:border-ash-green/80 transition-all duration-150 cursor-pointer">
			{/* Blue date banner — calendar icon + date is the entire identity */}
			<div className="bg-alice-blue px-5 py-3 flex items-center justify-between gap-2">
				<span className="text-whale-blue">
					<CalendarIcon />
				</span>
				<span className="text-sm font-bold text-whale-blue tracking-wide whitespace-nowrap">
					{card.date}
				</span>
			</div>

			<div className="p-5 flex flex-col gap-3 flex-1">
				<h3 className="font-display text-base font-bold text-rich-brown leading-snug tracking-tight">
					{card.title}
				</h3>

				<p className="text-sm text-warm-grey leading-relaxed line-clamp-2 flex-1">
					{card.description}
				</p>

				<div className="flex items-center gap-1.5 text-xs text-misty-forest">
					<PinIcon />
					<span>{card.location}</span>
				</div>

				<div className="border-t border-soft-grey/80 pt-3 flex items-center gap-2">
					<div className="w-6 h-6 rounded-full bg-melon-green flex items-center justify-center text-[10px] font-bold text-moss-green flex-shrink-0">
						{card.initials}
					</div>
					<span className="text-xs text-warm-grey">@{card.handle}</span>
				</div>
			</div>
		</div>
	);
}

// ─── Post Card ────────────────────────────────────────────────────────────────

function PostCard({ card }: { card: PostSample }) {
	return (
		<div
			className="group bg-grey-white border border-soft-grey rounded-lg flex flex-col hover:-translate-y-0.5 hover:border-ash-green/80 transition-all duration-150 cursor-pointer overflow-hidden"
			style={{ borderLeft: "3px dashed #C4D6B0" }}
		>
			{card.hasImage && (
				<div className="bg-soft-grey/60 h-36 flex items-center justify-center flex-shrink-0">
					<ImagePlaceholderIcon />
				</div>
			)}

			<div className="p-5 flex flex-col gap-2.5 flex-1">
				<h3 className="font-display text-[15px] font-bold text-rich-brown leading-snug tracking-tight">
					{card.title}
				</h3>

				<p className="text-sm text-warm-grey leading-relaxed line-clamp-3 flex-1">
					{card.description}
				</p>

				<div className="border-t border-soft-grey/80 pt-3 mt-0.5 flex items-center justify-between gap-2">
					<div className="flex items-center gap-2 min-w-0">
						<div className="w-6 h-6 rounded-full bg-melon-green flex items-center justify-center text-[10px] font-bold text-moss-green flex-shrink-0">
							{card.initials}
						</div>
						<span className="text-xs text-warm-grey truncate">
							@{card.handle}
						</span>
					</div>
					<div className="flex gap-1.5 flex-wrap justify-end">
						{card.tags.map((tag) => (
							<span
								key={tag}
								className="bg-melon-green/25 text-moss-green text-[11px] rounded-full px-2.5 py-0.5"
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

function SkeletonCard({ tall }: { tall?: boolean }) {
	return (
		<div className="bg-grey-white border border-soft-grey rounded-lg p-5 flex flex-col gap-3">
			<div className="flex items-center justify-between">
				<div className="h-4 w-20 bg-soft-grey rounded animate-pulse" />
				<div className="h-4 w-14 bg-soft-grey rounded animate-pulse" />
			</div>
			<div className="h-5 w-3/4 bg-soft-grey rounded animate-pulse" />
			{tall && (
				<div className="h-28 w-full bg-soft-grey rounded-md animate-pulse" />
			)}
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
			<div className="w-12 h-12 rounded-full bg-ash-green flex items-center justify-center mb-5 text-misty-forest">
				<PinIcon />
			</div>
			<p className="font-display text-xl font-bold text-rich-brown tracking-tight mb-1.5">
				Nothing pinned here yet.
			</p>
			<p className="text-sm text-warm-grey mb-8 max-w-xs leading-relaxed">
				Change your topic or search term — or add something to the board.
			</p>
			<div className="flex gap-3">
				<button className="px-5 py-2.5 text-sm font-medium border border-rich-brown text-rich-brown rounded-md hover:bg-rich-brown hover:text-grey-white transition-colors">
					Share a project
				</button>
				<button className="px-5 py-2.5 text-sm font-medium bg-rich-brown text-grey-white rounded-md hover:bg-muted-brown transition-colors">
					Post an event
				</button>
			</div>
		</div>
	);
}

// ─── Search Box ───────────────────────────────────────────────────────────────

function SearchBox({
	value,
	onChange,
	selectedTopics,
	onToggleTopic,
}: {
	value: string;
	onChange: (v: string) => void;
	selectedTopics: string[];
	onToggleTopic: (topic: string) => void;
}) {
	const [focused, setFocused] = useState(false);
	const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

	const suggestions = value.trim()
		? TOPICS.filter((t) =>
				t.toLowerCase().includes(value.toLowerCase())
		  )
		: [];

	const handleSelect = (topic: string) => {
		onToggleTopic(topic);
		onChange("");
	};

	const showDropdown = focused && suggestions.length > 0;

	return (
		<div className="relative w-full max-w-lg">
			<div className="absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none">
				<SearchIcon />
			</div>
			<input
				type="text"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				onFocus={() => setFocused(true)}
				onBlur={() => {
					blurTimer.current = setTimeout(() => setFocused(false), 150);
				}}
				placeholder="Search workshops, projects, people..."
				className="w-full bg-grey-white border border-soft-grey rounded-md pl-10 pr-4 py-2.5 text-sm text-rich-brown placeholder:text-dusty-grey/70 focus:outline-none focus:border-misty-forest focus:ring-1 focus:ring-misty-forest/20 transition-all"
			/>

			{showDropdown && (
				<div className="absolute top-full left-0 right-0 mt-1.5 bg-grey-white border border-soft-grey rounded-md shadow-sm overflow-hidden z-10">
					<div className="px-3 pt-2.5 pb-1">
						<span className="text-[10px] uppercase tracking-widest text-dusty-grey font-medium">
							Topics
						</span>
					</div>
					{suggestions.map((topic) => {
						const isActive = selectedTopics.includes(topic);
						return (
							<button
								key={topic}
								onMouseDown={() => handleSelect(topic)}
								className={`w-full text-left px-3 py-2 text-sm flex items-center gap-2 transition-colors ${
									isActive
										? "text-rich-brown font-semibold bg-ash-green/30"
										: "text-warm-grey hover:bg-ash-green/40 hover:text-rich-brown"
								}`}
							>
								<span
									className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
										isActive ? "bg-rich-brown" : "bg-melon-green"
									}`}
								/>
								{topic}
								{isActive && (
									<span className="ml-auto text-[10px] text-dusty-grey uppercase tracking-wide">
										active
									</span>
								)}
							</button>
						);
					})}
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
	const [search, setSearch] = useState("");

	const toggleTopic = (topic: string) =>
		setSelectedTopics((prev) =>
			prev.includes(topic) ? prev.filter((t) => t !== topic) : [...prev, topic]
		);

	const visibleCards = isEmpty
		? []
		: ALL_CARDS.filter((c) => activeType === "all" || c.type === activeType);

	return (
		<div className="min-h-screen bg-soft-grey">
			{/* eslint-disable-next-line @next/next/no-page-custom-font */}
			<link
				href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,600;9..144,700;9..144,800&display=swap"
				rel="stylesheet"
			/>

			<style>{`
				.font-display { font-family: 'Fraunces', serif; }
				.corkboard-bg {
					background-color: #CED0CE;
					background-image:
						radial-gradient(ellipse at 20% 50%, rgba(203,210,194,0.4) 0%, transparent 50%),
						radial-gradient(ellipse at 80% 20%, rgba(214,227,235,0.3) 0%, transparent 40%),
						radial-gradient(circle at 50% 80%, rgba(196,214,176,0.15) 0%, transparent 35%);
				}
				.masonry-grid {
					display: flex;
					margin-left: -20px;
					width: auto;
				}
				.masonry-grid_column {
					padding-left: 20px;
					background-clip: padding-box;
				}
				.masonry-grid_column > div {
					margin-bottom: 20px;
				}
				.masonry-list {
					display: flex;
					margin-left: 0;
					width: auto;
					max-width: 42rem;
				}
				.masonry-list_column {
					padding-left: 0;
					background-clip: padding-box;
				}
				.masonry-list_column > div {
					margin-bottom: 16px;
				}
			`}</style>

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

			{/* ── Header zone ── */}
			<div className="bg-ash-green px-6 py-3">
				<div className="max-w-6xl mx-auto">
					<h1 className="font-display text-2xl font-extrabold tracking-tight text-rich-brown mb-0.5">
						Explore
					</h1>
					<p className="text-sm text-misty-forest mb-3">
						See what your community is making and sharing
					</p>
					<SearchBox
						value={search}
						onChange={setSearch}
						selectedTopics={selectedTopics}
						onToggleTopic={toggleTopic}
					/>
				</div>
			</div>

			{/* ── Content area with corkboard texture ── */}
			<div className="corkboard-bg">
				<div className="max-w-6xl mx-auto px-6 pt-4 pb-6">
					{/* ── Topic tabs ── */}
					<div className="mb-3 flex items-center gap-2 overflow-x-auto pb-px scrollbar-none">
						<span className="text-xs text-dusty-grey whitespace-nowrap flex-shrink-0 font-medium">
							Browse by:
						</span>
						{TOPICS.map((topic) => {
							const active = selectedTopics.includes(topic);
							return (
								<button
									key={topic}
									onClick={() => toggleTopic(topic)}
									className={`flex-shrink-0 px-3 py-1.5 text-sm transition-all duration-100 whitespace-nowrap ${
										active
											? "bg-grey-white text-rich-brown font-semibold border-t-2 border-rich-brown rounded-sm shadow-sm"
											: "bg-soft-grey/60 text-warm-grey hover:bg-grey-white/70 hover:text-rich-brown rounded-sm"
									}`}
								>
									{topic}
								</button>
							);
						})}
					</div>

					{/* ── Filter bar ── */}
					<div className="flex items-center justify-between py-2 border-b border-soft-grey/60 mb-4">
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
									className={`px-3.5 py-1 text-sm rounded-full transition-colors ${
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
									className={`p-1.5 rounded transition-colors ${
										view === "list"
											? "text-rich-brown"
											: "text-dusty-grey hover:text-warm-grey"
									}`}
									title="List view"
								>
									<svg
										width="15"
										height="15"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									>
										<line x1="3" y1="6" x2="21" y2="6" />
										<line x1="3" y1="12" x2="21" y2="12" />
										<line x1="3" y1="18" x2="21" y2="18" />
									</svg>
								</button>
								<button
									onClick={() => setView("grid")}
									className={`p-1.5 rounded transition-colors ${
										view === "grid"
											? "text-rich-brown"
											: "text-dusty-grey hover:text-warm-grey"
									}`}
									title="Grid view"
								>
									<svg
										width="15"
										height="15"
										viewBox="0 0 24 24"
										fill="none"
										stroke="currentColor"
										strokeWidth="2"
										strokeLinecap="round"
									>
										<rect x="3" y="3" width="7" height="7" />
										<rect x="14" y="3" width="7" height="7" />
										<rect x="3" y="14" width="7" height="7" />
										<rect x="14" y="14" width="7" height="7" />
									</svg>
								</button>
							</div>
						</div>
					</div>

					{/* ── Content ── */}
					{isLoading ? (
						<Masonry
							breakpointCols={
								view === "grid" ? MASONRY_BREAKPOINTS : 1
							}
							className={
								view === "grid" ? "masonry-grid" : "masonry-list"
							}
							columnClassName={
								view === "grid"
									? "masonry-grid_column"
									: "masonry-list_column"
							}
						>
							{Array.from({ length: 6 }).map((_, i) => (
								<SkeletonCard key={i} tall={i % 3 === 1} />
							))}
						</Masonry>
					) : visibleCards.length === 0 ? (
						<EmptyState />
					) : (
						<Masonry
							breakpointCols={
								view === "grid" ? MASONRY_BREAKPOINTS : 1
							}
							className={
								view === "grid" ? "masonry-grid" : "masonry-list"
							}
							columnClassName={
								view === "grid"
									? "masonry-grid_column"
									: "masonry-list_column"
							}
						>
							{visibleCards.map((card) =>
								card.type === "event" ? (
									<EventCard key={card.id} card={card} />
								) : (
									<PostCard key={card.id} card={card} />
								)
							)}
						</Masonry>
					)}
				</div>
			</div>
		</div>
	);
}
