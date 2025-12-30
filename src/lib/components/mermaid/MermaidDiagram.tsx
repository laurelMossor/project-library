"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface MermaidDiagramProps {
	chart: string;
	className?: string;
}

const makeRenderId = () => `mermaid-${Math.random().toString(16).slice(2)}`;

const getMermaid = async () => {
	const mermaidModule = await import("mermaid");
	return mermaidModule.default ?? mermaidModule;
};

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

function preparePanZoomGroup(svg: SVGSVGElement): SVGGElement {
	const existing = svg.querySelector<SVGGElement>('g[data-pan-zoom="true"]');
	if (existing) {
		return existing;
	}

	const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
	group.setAttribute("data-pan-zoom", "true");

	const defs = svg.querySelector("defs");
	const nodesToMove: ChildNode[] = [];
	svg.childNodes.forEach((node) => {
		if (node === defs) {
			return;
		}
		nodesToMove.push(node);
	});
	nodesToMove.forEach((node) => group.appendChild(node));

	if (defs) {
		svg.insertBefore(group, defs.nextSibling);
	} else {
		svg.appendChild(group);
	}

	// Better defaults for embedding.
	svg.setAttribute("width", "100%");
	svg.setAttribute("height", "100%");

	return group;
}

function clientPointToSvgPoint(
	svg: SVGSVGElement,
	clientX: number,
	clientY: number
): { x: number; y: number } | null {
	const ctm = svg.getScreenCTM();
	if (!ctm) {
		return null;
	}

	const point = new DOMPoint(clientX, clientY);
	const svgPoint = point.matrixTransform(ctm.inverse());
	return { x: svgPoint.x, y: svgPoint.y };
}

export default function MermaidDiagram({
	chart,
	className
}: MermaidDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderIdRef = useRef<string>(makeRenderId());
	const [error, setError] = useState<string | null>(null);
	const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
	const svgRef = useRef<SVGSVGElement | null>(null);
	const panZoomGroupRef = useRef<SVGGElement | null>(null);
	const isDraggingRef = useRef(false);
	const didDragRef = useRef(false);
	const dragStartRef = useRef<{
		startPointerSvgX: number;
		startPointerSvgY: number;
		startX: number;
		startY: number;
	} | null>(null);

	const wrapperClassName = ["relative overflow-hidden", className ?? ""]
		.filter(Boolean)
		.join(" ");

	const zoomSteps = useMemo(
		() => ({
			min: 0.5,
			max: 2.8,
			step: 0.2,
			medium: 1.6
		}),
		[]
	);

	useEffect(() => {
		if (!chart) {
			return;
		}

		let cancelled = false;

		getMermaid().then((mermaid) => {
			if (cancelled) {
				return;
			}

			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "loose"
			});

			try {
				mermaid.parse(chart);
			} catch (parseError) {
				if (cancelled) {
					return;
				}

				setError(
					parseError instanceof Error ? parseError.message : "Invalid mermaid diagram"
				);
				return;
			}

			mermaid
				.render(renderIdRef.current, chart)
				.then((result) => {
					if (cancelled || !containerRef.current) {
						return;
					}

					const svg = typeof result === "string" ? result : result.svg;
					containerRef.current.innerHTML = svg ?? "";
					const svgEl =
						containerRef.current.querySelector<SVGSVGElement>("svg") ?? null;
					svgRef.current = svgEl;
					panZoomGroupRef.current = svgEl ? preparePanZoomGroup(svgEl) : null;
					setError(null);
				})
				.catch((renderError) => {
					if (cancelled) {
						return;
					}

					setError(
						renderError instanceof Error
							? renderError.message
							: "Unable to render mermaid diagram"
					);
				});
		});

		return () => {
			cancelled = true;
		};
	}, [chart]);

	useEffect(() => {
		setTransform({ scale: 1, x: 0, y: 0 });
	}, [chart]);

	useEffect(() => {
		const group = panZoomGroupRef.current;
		if (!group) {
			return;
		}

		group.setAttribute(
			"transform",
			// Important: SVG transforms are applied in order. We want: (scale content) then (translate in screen/svg units).
			`scale(${transform.scale}) translate(${transform.x} ${transform.y})`
		);
	}, [transform, chart]);

	const getContainerCenterSvgPoint = (): { x: number; y: number } | null => {
		const svg = svgRef.current;
		const container = containerRef.current;
		if (!svg || !container) {
			return null;
		}

		const rect = container.getBoundingClientRect();
		return clientPointToSvgPoint(
			svg,
			rect.left + rect.width / 2,
			rect.top + rect.height / 2
		);
	};

	const zoomToScaleKeepingCenter = (nextScale: number) => {
		const center = getContainerCenterSvgPoint();
		if (!center) {
			return;
		}

		setTransform((current) => {
			const clampedScale = clamp(nextScale, zoomSteps.min, zoomSteps.max);
			// center = scale * content + translate  => content = (center - translate) / scale
			const centerContentX = (center.x - current.x) / current.scale;
			const centerContentY = (center.y - current.y) / current.scale;

			return {
				scale: clampedScale,
				x: center.x - centerContentX * clampedScale,
				y: center.y - centerContentY * clampedScale
			};
		});
	};

	const handleZoomIn = () => zoomToScaleKeepingCenter(transform.scale + zoomSteps.step);
	const handleZoomOut = () =>
		zoomToScaleKeepingCenter(transform.scale - zoomSteps.step);
	const handleReset = () => setTransform({ scale: 1, x: 0, y: 0 });

	const findNodeElement = (target: Element | null): SVGGraphicsElement | null => {
		const svg = svgRef.current;
		if (!svg || !target) {
			return null;
		}

		// Prefer explicit mermaid node groups when present.
		const closestNode = target.closest?.(
			"g.node, g.cluster"
		) as SVGGraphicsElement | null;
		if (closestNode) {
			return closestNode;
		}

		// Fallback: walk up to the nearest <g> that looks like a node-ish container.
		let el: Element | null = target;
		while (el && el !== svg) {
			if (el instanceof SVGGraphicsElement && el.tagName.toLowerCase() === "g") {
				const classAttr = el.getAttribute("class") ?? "";
				if (/\b(node|cluster)\b/.test(classAttr)) {
					return el;
				}
			}
			el = el.parentElement;
		}

		return null;
	};

	const centerNodeAtMediumZoom = (node: SVGGraphicsElement) => {
		const svg = svgRef.current;
		if (!svg) {
			return;
		}
		const center = getContainerCenterSvgPoint();
		if (!center) {
			return;
		}

		const nodeRect = node.getBoundingClientRect();
		const nodeCenterClientX = nodeRect.left + nodeRect.width / 2;
		const nodeCenterClientY = nodeRect.top + nodeRect.height / 2;

		const nodeCenter = clientPointToSvgPoint(
			svg,
			nodeCenterClientX,
			nodeCenterClientY
		);
		if (!nodeCenter) {
			return;
		}

		const medium = zoomSteps.medium;

		// nodeCenter is in *current* svg/screen coordinates. Convert it back to content coordinates first.
		const nodeContentX = (nodeCenter.x - transform.x) / transform.scale;
		const nodeContentY = (nodeCenter.y - transform.y) / transform.scale;

		setTransform({
			scale: medium,
			x: center.x - nodeContentX * medium,
			y: center.y - nodeContentY * medium
		});
	};

	const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
		// Don't start dragging if the user is selecting text in controls.
		if (event.button !== 0) {
			return;
		}
		isDraggingRef.current = true;
		didDragRef.current = false;
		const svg = svgRef.current;
		if (!svg) {
			return;
		}
		const startPointer = clientPointToSvgPoint(svg, event.clientX, event.clientY);
		if (!startPointer) {
			return;
		}

		dragStartRef.current = {
			startPointerSvgX: startPointer.x,
			startPointerSvgY: startPointer.y,
			startX: transform.x,
			startY: transform.y
		};
		(event.currentTarget as HTMLDivElement).setPointerCapture(event.pointerId);
	};

	const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
		const dragStart = dragStartRef.current;
		if (!isDraggingRef.current || !dragStart) {
			return;
		}

		const svg = svgRef.current;
		if (!svg) {
			return;
		}

		const currentPointer = clientPointToSvgPoint(svg, event.clientX, event.clientY);
		if (!currentPointer) {
			return;
		}

		const dxSvg = currentPointer.x - dragStart.startPointerSvgX;
		const dySvg = currentPointer.y - dragStart.startPointerSvgY;

		if (Math.abs(dxSvg) + Math.abs(dySvg) > 2) {
			didDragRef.current = true;
		}

		setTransform((current) => ({
			...current,
			x: dragStart.startX + dxSvg,
			y: dragStart.startY + dySvg
		}));
	};

	const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
		// Treat a pointer-up that did not move as a "click" even when we used pointer capture.
		if (!didDragRef.current && event.button === 0) {
			const el = document.elementFromPoint(event.clientX, event.clientY);
			const node = findNodeElement(el);
			if (node) {
				centerNodeAtMediumZoom(node);
			}
		}

		isDraggingRef.current = false;
		dragStartRef.current = null;
		try {
			(event.currentTarget as HTMLDivElement).releasePointerCapture(event.pointerId);
		} catch {
			// ignore
		}
	};

	return (
		<div className={wrapperClassName}>
			<div className="pointer-events-none absolute right-3 top-3 z-10 flex items-center gap-2">
				<div className="pointer-events-auto flex items-center gap-1 rounded-full border border-slate-200 bg-white/90 p-1 shadow-sm backdrop-blur">
					<button
						type="button"
						onClick={handleZoomOut}
						className="h-8 w-8 rounded-full text-slate-700 hover:bg-slate-100"
						aria-label="Zoom out"
					>
						−
					</button>
					<button
						type="button"
						onClick={handleZoomIn}
						className="h-8 w-8 rounded-full text-slate-700 hover:bg-slate-100"
						aria-label="Zoom in"
					>
						+
					</button>
					<button
						type="button"
						onClick={handleReset}
						className="h-8 px-3 rounded-full text-sm text-slate-700 hover:bg-slate-100"
					>
						Reset
					</button>
				</div>
			</div>
			{error && (
				<p className="text-sm text-rose-500">Failed to render graph: {error}</p>
			)}
			<div
				ref={containerRef}
				className="h-full w-full touch-none select-none"
				onPointerDown={handlePointerDown}
				onPointerMove={handlePointerMove}
				onPointerUp={handlePointerUp}
				onPointerCancel={handlePointerUp}
			/>
		</div>
	);
}

