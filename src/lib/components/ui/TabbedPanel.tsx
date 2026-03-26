"use client";

import { useState, ReactNode } from "react";

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
  "border-b-0 border-soft-grey bg-grey-white text-rich-brown z-10 relative -mb-px pb-[calc(0.625rem+1px)]";
const INACTIVE_TOP =
  "border-soft-grey bg-ash-green/60 text-misty-forest hover:bg-ash-green hover:text-warm-grey";

const ACTIVE_LEFT =
  "border-r-0 border-soft-grey bg-grey-white text-rich-brown z-10 relative -mr-px pr-[calc(0.75rem+1px)]";
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

  return (
    <div className="w-full">
      {/* Top row: spacer aligns with left column + top tabs */}
      <div className="flex items-end">
        <div className="w-36 shrink-0" />
        <div className="flex items-end gap-1.5 px-1">
          {topTabs.map((tab) => {
            const isActive = tab.id === activeTop;
            const count = getCount?.(activeLeft, tab.id);
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTop(tab.id)}
                className={`px-5 py-2.5 text-sm font-medium rounded-t-lg border transition-colors cursor-pointer select-none ${
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
        <div className="flex flex-col gap-1.5 pb-1 w-36 shrink-0">
          {leftTabs.map((tab) => {
            const isActive = tab.id === activeLeft;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveLeft(tab.id)}
                className={`px-3 py-2.5 text-sm font-medium rounded-l-lg border w-full text-right leading-tight transition-colors cursor-pointer select-none ${
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
