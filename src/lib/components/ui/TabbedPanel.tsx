"use client";

import { useState, ReactNode } from "react";
import { useBreakpoint } from "@/lib/hooks/useBreakpoint";

export type TabDef<TId extends string = string> = {
  id: TId;
  label: string;
};

type TabbedPanelProps<TTop extends string, TLeft extends string> = {
  topTabs: readonly TabDef<TTop>[];
  leftTabs: readonly TabDef<TLeft>[];
  renderContent: (left: TLeft, top: TTop) => ReactNode;
  /** Override left tab label rendering — receives the full TabDef so callers can act on metadata */
  renderLeftTab?: (tab: TabDef<TLeft>) => ReactNode;
  /** Optional badge count shown next to each top tab label */
  getCount?: (left: TLeft, top: TTop) => number;
  defaultTop?: TTop;
  defaultLeft?: TLeft;
};

const ACTIVE_TOP =
  "border-b-0 border-soft-grey bg-grey-white text-rich-brown -mb-px pb-[calc(0.625rem+1px)]";
const INACTIVE_TOP =
  "border-soft-grey bg-ash-green/60 text-misty-forest hover:bg-ash-green hover:text-warm-grey";

const ACTIVE_LEFT =
  "border-r-0 border-soft-grey bg-grey-white text-rich-brown z-10 relative translate-x-1 -mr-1";
const INACTIVE_LEFT =
  "border-soft-grey bg-ash-green/60 text-misty-forest hover:bg-ash-green hover:text-warm-grey";

export function TabbedPanel<TTop extends string, TLeft extends string>({
  topTabs,
  leftTabs,
  renderContent,
  renderLeftTab,
  getCount,
  defaultTop,
  defaultLeft,
}: TabbedPanelProps<TTop, TLeft>) {
  const [activeTop, setActiveTop] = useState<TTop>(
    defaultTop ?? topTabs[0].id
  );
  const [activeLeft, setActiveLeft] = useState<TLeft>(
    defaultLeft ?? leftTabs[0].id
  );

  // matchMedia is more reliable than innerWidth on mobile Safari.
  const isMobile = useBreakpoint(
    () => window.matchMedia("(max-width: 639px)").matches,
    false
  );

  const activeIndex = topTabs.findIndex((t) => t.id === activeTop);
  // When the rightmost tab is active, compress inactive tabs more so it fits fully in view.
  const isRightmostActive = activeIndex === topTabs.length - 1;

  return (
    <div className="w-full">
      {/* Top row: spacer aligns with left column + top tabs */}
      {/* overflow-hidden clips the right edge on mobile so tabs don't bleed past viewport */}
      {/* isolation: isolate ensures z-index stacking works correctly in Safari */}
      <div className="flex items-end overflow-hidden sm:overflow-visible">
        <div className="w-20 sm:w-36 shrink-0" />
        <div className="flex items-end pl-1 sm:gap-1.5 sm:px-1" style={{ isolation: "isolate" }}>
          {topTabs.map((tab, i) => {
            const isActive = tab.id === activeTop;
            const count = getCount?.(activeLeft, tab.id);
            // Overlap amount: increase when rightmost tab is active so it fits fully on screen.
            // CSS class (-ml-9) is the baseline and renders before JS hydrates.
            // Inline style overrides when JS confirms mobile + rightmost active.
            const mobileMargin = isMobile && isRightmostActive ? "-44px" : undefined;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTop(tab.id)}
                // z-index via inline style works reliably across all browsers including Safari.
                // Active tab always floats above all others; earlier inactive tabs above later ones.
                style={{
                  zIndex: isActive ? topTabs.length + 1 : topTabs.length - i,
                  ...(i > 0 && mobileMargin ? { marginLeft: mobileMargin } : {}),
                }}
                className={`relative ${i > 0 ? "-ml-9 sm:ml-0" : ""} px-3 py-2 text-xs sm:px-5 sm:py-2.5 sm:text-sm font-medium rounded-t-lg border transition-[margin] duration-150 cursor-pointer select-none ${
                  isActive ? ACTIVE_TOP : INACTIVE_TOP
                }`}
              >
                {tab.label}
                {count !== undefined && (
                  <span className="ml-1.5 text-xs opacity-60">({count})</span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Main row: left tabs + panel */}
      <div className="flex items-start">
        {/* Left tab column — no top padding keeps first tab flush with panel top border */}
        <div className="flex flex-col gap-1.5 pb-1 w-20 sm:w-36 shrink-0">
          {leftTabs.map((tab) => {
            const isActive = tab.id === activeLeft;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveLeft(tab.id)}
                className={`px-2 py-2 text-xs break-words whitespace-normal sm:px-3 sm:py-2.5 sm:text-sm sm:break-normal font-medium rounded-l-lg border w-full text-right leading-tight transition-colors cursor-pointer select-none ${
                  isActive ? ACTIVE_LEFT : INACTIVE_LEFT
                }`}
              >
                {renderLeftTab ? renderLeftTab(tab) : tab.label}
              </button>
            );
          })}
        </div>

        {/* Panel */}
        <div className="border border-soft-grey rounded-b-xl rounded-tr-xl bg-grey-white shadow-glow min-h-96 flex-1 overflow-hidden">
          {renderContent(activeLeft, activeTop)}
        </div>
      </div>
    </div>
  );
}
