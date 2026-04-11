// src/components/chart/SetupContextBar.tsx
// Compact horizontal context strip rendered above the chart canvas.
// Pure presentation — no hooks. Surfaces the deterministic engine's
// state for the active setup so chart, signal cards, and pair analysis
// all visibly draw from the same source.

import { ArrowUpRight, ArrowDownRight, Layers, TrendingUp, TrendingDown, Minus, Ban } from "lucide-react";
import StatusBadge from "@/components/ui/status-badge";
import { Progress } from "@/components/ui/progress";
import type {
  SetupQuality,
  Verdict,
  MarketStructure,
  TrendDirection,
} from "@/types/trading";

interface SetupContextBarProps {
  setupType: string | null;
  direction: "long" | "short" | null;
  confidence: number | null;
  quality: SetupQuality | null;
  verdict: Verdict | null;
  marketStructure: MarketStructure | null;
  htfBias: TrendDirection | null;
}

const STRUCTURE_LABEL: Record<MarketStructure, string> = {
  trending: "Trending",
  ranging: "Ranging",
  breakout: "Breakout",
};

function qualityVariant(q: SetupQuality) {
  if (q === "A+" || q === "A") return "bullish" as const;
  if (q === "B") return "neutral" as const;
  return "bearish" as const;
}

function structureVariant(s: MarketStructure) {
  if (s === "trending") return "bullish" as const;
  if (s === "breakout") return "neutral" as const;
  return "bearish" as const;
}

function biasIcon(t: TrendDirection) {
  if (t === "bullish") return <TrendingUp className="h-3 w-3 text-bullish" />;
  if (t === "bearish") return <TrendingDown className="h-3 w-3 text-bearish" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
}

export default function SetupContextBar({
  setupType,
  direction,
  confidence,
  quality,
  verdict,
  marketStructure,
  htfBias,
}: SetupContextBarProps) {
  const hasAnyEngineState = setupType || verdict || marketStructure || htfBias;

  if (!hasAnyEngineState) {
    return (
      <div className="px-3 py-2 border-b border-border bg-muted/10 text-[11px] text-muted-foreground">
        No active setup — engine has not produced a verdict for this pair yet
      </div>
    );
  }

  const isLong = direction === "long";
  const isNoTrade = verdict === "no_trade";

  return (
    <div className="px-3 py-2 border-b border-border bg-muted/10 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[11px]">
      {/* Setup type + direction */}
      {setupType && (
        <div className="flex items-center gap-1.5">
          {direction && !isNoTrade && (
            isLong
              ? <ArrowUpRight className="h-3 w-3 text-bullish" />
              : <ArrowDownRight className="h-3 w-3 text-bearish" />
          )}
          {isNoTrade && <Ban className="h-3 w-3 text-warning" />}
          <span className="font-semibold text-foreground">{setupType}</span>
        </div>
      )}

      {/* Verdict */}
      {verdict && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Verdict:</span>
          <StatusBadge variant={isNoTrade ? "expired" : "bullish"} className="text-[10px]">
            {isNoTrade ? "No Trade" : "Trade"}
          </StatusBadge>
        </div>
      )}

      {/* Confidence */}
      {confidence != null && (
        <div className="flex items-center gap-1.5">
          <span className="text-muted-foreground">Conf</span>
          <Progress value={confidence} className="h-1.5 w-14" />
          <span className="font-mono font-semibold text-foreground">{confidence}%</span>
        </div>
      )}

      {/* Quality */}
      {quality && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">Quality:</span>
          <StatusBadge variant={qualityVariant(quality)} className="text-[10px]">{quality}</StatusBadge>
        </div>
      )}

      {/* Market structure */}
      {marketStructure && (
        <div className="flex items-center gap-1">
          <Layers className="h-3 w-3 text-muted-foreground" />
          <span className="text-muted-foreground">Structure:</span>
          <StatusBadge variant={structureVariant(marketStructure)} className="text-[10px]">
            {STRUCTURE_LABEL[marketStructure]}
          </StatusBadge>
        </div>
      )}

      {/* Higher TF bias (D1) */}
      {htfBias && (
        <div className="flex items-center gap-1">
          <span className="text-muted-foreground">D1 bias:</span>
          {biasIcon(htfBias)}
          <span className="font-medium text-foreground capitalize">{htfBias}</span>
        </div>
      )}
    </div>
  );
}
