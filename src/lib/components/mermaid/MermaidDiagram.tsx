"use client";

import { useEffect, useId, useRef, useState } from "react";

interface MermaidDiagramProps {
	chart: string;
	className?: string;
	/** Initial zoom level when the diagram first renders. */
	initialScale?: number;
	/** Zoom level to snap to when clicking a node to center it. */
	clickZoomScale?: number;
}

export const MERMAID_ZOOM_DEFAULTS = {
	/** Minimum allowed zoom (scale). */
	minScale: 0.5,
	/** Maximum allowed zoom (scale). */
	maxScale: 5,
	/** Increment/decrement for +/- buttons. */
	buttonStep: 0.4,
	/** Initial zoom level when the diagram first renders. */
	initialScale: 2.5,
	/** Zoom level to snap to when clicking a node to center it. */
	// Note: clamped by maxScale.
	clickZoomScale: 3.8
} as const;

/**
 * Styling overrides for Mermaid's rendered SVG nodes.
 * Tweak these values to change node text + box appearance without touching logic.
 */
export const MERMAID_NODE_STYLE_DEFAULTS = {
	/** Node label font family */
	fontFamily:
		'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
	/** Node label font size (px) */
	fontSizePx: 20,
	/** Line-height used for htmlLabels (unitless). Keeping this stable helps Mermaid measure nodes correctly. */
	lineHeight: 1.2,
	/**
	 * Padding used inside htmlLabels (px). Increasing this makes nodes feel "bigger"
	 * without relying on post-render DOM hacks.
	 */
	labelPaddingPx: { x: 14, y: 10 },
	/**
	 * Max label width (px) for htmlLabels before wrapping.
	 * Increase if you want wider nodes; decrease if you prefer more wrapping.
	 */
	maxLabelWidthPx: 360,
	/** Node label text color */
	textColor: "#0f172a",
	/** Node rectangle fill */
	fillColor: "var(--color-melon-green)",
	/** Node rectangle stroke */
	strokeColor: "var(--color-soft-grey)",
	/** Node rectangle stroke width */
	strokeWidthPx: 1,
	/** Node rectangle corner radius (rx/ry attributes) */
	cornerRadiusPx: 10
} as const;

const makeRenderId = () => `mermaid-${Math.random().toString(16).slice(2)}`;

/**
 * Prefer Mermaid theme variables for sizing/styling so geometry is calculated correctly
 * (especially when using `htmlLabels`, which rely on HTML measurement).
 */
const resolveCssColor = (value: string): string => {
	const trimmed = value.trim();
	if (!trimmed) {
		return trimmed;
	}

	// Mermaid's themeVariables do not support CSS `var(...)` at runtime.
	// Resolve to a concrete computed value (e.g. rgb(...) or #...).
	const varMatch = /^var\(\s*(--[^)\s,]+)\s*(?:,[^)]+)?\)$/.exec(trimmed);
	if (!varMatch) {
		return trimmed;
	}

	const varName = varMatch[1];
	const computed = getComputedStyle(document.documentElement)
		.getPropertyValue(varName)
		.trim();

	return computed || trimmed;
};

const getResolvedMermaidThemeVariables = () => ({
	fontFamily: MERMAID_NODE_STYLE_DEFAULTS.fontFamily,
	fontSize: `${MERMAID_NODE_STYLE_DEFAULTS.fontSizePx}px`,
	primaryColor: resolveCssColor(MERMAID_NODE_STYLE_DEFAULTS.fillColor),
	primaryBorderColor: resolveCssColor(MERMAID_NODE_STYLE_DEFAULTS.strokeColor),
	primaryTextColor: MERMAID_NODE_STYLE_DEFAULTS.textColor,
	lineColor: resolveCssColor(MERMAID_NODE_STYLE_DEFAULTS.strokeColor)
});

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

function applyMermaidNodeStyling(
	svg: SVGSVGElement,
	resolvedColors?: { fillColor: string; strokeColor: string }
) {
	const existingStyle = svg.querySelector("style[data-mermaid-node-style]");
	if (existingStyle) {
		existingStyle.remove();
	}

	const fillColor = resolvedColors?.fillColor ?? MERMAID_NODE_STYLE_DEFAULTS.fillColor;
	const strokeColor =
		resolvedColors?.strokeColor ?? MERMAID_NODE_STYLE_DEFAULTS.strokeColor;

	const styleEl = document.createElementNS("http://www.w3.org/2000/svg", "style");
	styleEl.setAttribute("data-mermaid-node-style", "true");
	// Make overrides hard to defeat (Mermaid themes sometimes inject their own <style> later,
	// and may set inline styles). We do both:
	// - a <style> tag with !important
	// - direct presentation attributes + inline style on the elements we care about
	styleEl.textContent = `
		svg .node text, svg .cluster text {
			font-family: ${MERMAID_NODE_STYLE_DEFAULTS.fontFamily} !important;
			font-size: ${MERMAID_NODE_STYLE_DEFAULTS.fontSizePx}px !important;
			fill: ${MERMAID_NODE_STYLE_DEFAULTS.textColor} !important;
		}

		svg .node rect, svg .cluster rect {
			fill: ${fillColor} !important;
			stroke: ${strokeColor} !important;
			stroke-width: ${MERMAID_NODE_STYLE_DEFAULTS.strokeWidthPx}px !important;
		}
	`;

	// Append at the end so it wins the CSS cascade.
	svg.appendChild(styleEl);

	const setImportantStyle = (
		el: { style: CSSStyleDeclaration },
		property: string,
		value: string
	) => {
		el.style.setProperty(property, value, "important");
	};

	// rx/ry + fill/stroke set as attributes to override presentation defaults.
	svg.querySelectorAll<SVGRectElement>("g.node rect, g.cluster rect").forEach((rect) => {
		rect.setAttribute("rx", String(MERMAID_NODE_STYLE_DEFAULTS.cornerRadiusPx));
		rect.setAttribute("ry", String(MERMAID_NODE_STYLE_DEFAULTS.cornerRadiusPx));
		rect.setAttribute("fill", fillColor);
		rect.setAttribute("stroke", strokeColor);
		rect.setAttribute("stroke-width", String(MERMAID_NODE_STYLE_DEFAULTS.strokeWidthPx));
	});

	svg.querySelectorAll<SVGTextElement>("g.node text, g.cluster text").forEach((text) => {
		text.setAttribute("fill", MERMAID_NODE_STYLE_DEFAULTS.textColor);
		setImportantStyle(text, "font-family", MERMAID_NODE_STYLE_DEFAULTS.fontFamily);
		setImportantStyle(
			text,
			"font-size",
			`${MERMAID_NODE_STYLE_DEFAULTS.fontSizePx}px`
		);
	});

	// NOTE: We intentionally do NOT restyle htmlLabels (<foreignObject>) here.
	// Changing font metrics post-render causes Mermaid node boxes to be measured too small,
	// leading to clipped/overflowing text. We apply htmlLabel styles pre-render via scoped CSS
	// and Mermaid theme variables instead.
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
	className,
	initialScale = MERMAID_ZOOM_DEFAULTS.initialScale,
	clickZoomScale = MERMAID_ZOOM_DEFAULTS.clickZoomScale
}: MermaidDiagramProps) {
	const scopeId = useId();
	const containerRef = useRef<HTMLDivElement>(null);
	const renderIdRef = useRef<string>(makeRenderId());
	const [error, setError] = useState<string | null>(null);
	const [transform, setTransform] = useState({ scale: 1, x: 0, y: 0 });
	const [renderNonce, setRenderNonce] = useState(0);
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

	const zoomConfig = MERMAID_ZOOM_DEFAULTS;

	// Inject scoped CSS so Mermaid measures html labels with wrapping/max-width already applied.
	useEffect(() => {
		const styleId = `mermaid-style-${scopeId}`;
		if (document.getElementById(styleId)) {
			return;
		}

		const styleEl = document.createElement("style");
		styleEl.id = styleId;
		styleEl.textContent = `
			/* Ensure htmlLabel foreignObjects don't clip their HTML contents. */
			[data-mermaid-scope="${scopeId}"] foreignObject {
				overflow: visible;
			}

			[data-mermaid-scope="${scopeId}"] .nodeLabel,
			[data-mermaid-scope="${scopeId}"] .label,
			[data-mermaid-scope="${scopeId}"] foreignObject .nodeLabel,
			[data-mermaid-scope="${scopeId}"] foreignObject .label {
				font-family: ${MERMAID_NODE_STYLE_DEFAULTS.fontFamily};
				font-size: ${MERMAID_NODE_STYLE_DEFAULTS.fontSizePx}px;
				line-height: ${MERMAID_NODE_STYLE_DEFAULTS.lineHeight};
				color: ${MERMAID_NODE_STYLE_DEFAULTS.textColor};
				display: inline-block;
				/* Let the label size itself; Mermaid will measure this during render when we pass a container. */
				width: fit-content;
				max-width: ${MERMAID_NODE_STYLE_DEFAULTS.maxLabelWidthPx}px;
				white-space: normal;
				word-break: break-word;
				overflow-wrap: anywhere;
				overflow: visible;
				text-align: center;
				box-sizing: border-box;
				padding: ${MERMAID_NODE_STYLE_DEFAULTS.labelPaddingPx.y}px ${MERMAID_NODE_STYLE_DEFAULTS.labelPaddingPx.x}px;
			}
		`;

		document.head.appendChild(styleEl);

		return () => {
			styleEl.remove();
		};
	}, [scopeId]);

	useEffect(() => {
		if (!chart) {
			return;
		}

		const localContainer = containerRef.current;
		if (!localContainer) {
			return;
		}

		let cancelled = false;

		getMermaid().then((mermaid) => {
			if (cancelled) {
				return;
			}

			const resolvedThemeVariables = getResolvedMermaidThemeVariables();

			mermaid.initialize({
				startOnLoad: false,
				securityLevel: "loose",
				theme: "base",
				themeVariables: resolvedThemeVariables,
				flowchart: {
					htmlLabels: true,
					useMaxWidth: true
				}
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
				.render(renderIdRef.current, chart, localContainer)
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
					if (svgEl) {
						applyMermaidNodeStyling(svgEl, {
							fillColor: resolvedThemeVariables.primaryColor,
							strokeColor: resolvedThemeVariables.primaryBorderColor
						});
					}
					setRenderNonce((n) => n + 1);
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
		// Reset pan/zoom between charts; we then apply the initial zoom once the SVG is available.
		setTransform({ scale: 1, x: 0, y: 0 });
	}, [chart]);

	useEffect(() => {
		const group = panZoomGroupRef.current;
		if (!group) {
			return;
		}

		// Use a single matrix so we have an unambiguous coordinate system:
		// screen = scale * content + translate
		// where translate is NOT scaled (prevents "jumping" when re-centering).
		group.setAttribute(
			"transform",
			`matrix(${transform.scale} 0 0 ${transform.scale} ${transform.x} ${transform.y})`
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
			const clampedScale = clamp(nextScale, zoomConfig.minScale, zoomConfig.maxScale);
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

	// Apply initial zoom after we have an SVG in the DOM.
	useEffect(() => {
		if (!svgRef.current) {
			return;
		}
		zoomToScaleKeepingCenter(initialScale);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [renderNonce, initialScale]);

	const handleZoomIn = () =>
		zoomToScaleKeepingCenter(transform.scale + zoomConfig.buttonStep);
	const handleZoomOut = () =>
		zoomToScaleKeepingCenter(transform.scale - zoomConfig.buttonStep);
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

		const fixedZoom = clamp(clickZoomScale, zoomConfig.minScale, zoomConfig.maxScale);

		// nodeCenter is in *current* svg/screen coordinates. Convert it back to content coordinates first.
		const nodeContentX = (nodeCenter.x - transform.x) / transform.scale;
		const nodeContentY = (nodeCenter.y - transform.y) / transform.scale;

		setTransform({
			scale: fixedZoom,
			x: center.x - nodeContentX * fixedZoom,
			y: center.y - nodeContentY * fixedZoom
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
		<div className={wrapperClassName} data-mermaid-scope={scopeId}>
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

