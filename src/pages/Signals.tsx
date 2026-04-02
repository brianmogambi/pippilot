import { useState } from "react";
import { mockSignals } from "@/data/mockSignals";
import SignalCard from "@/components/signals/SignalCard";
import { Button } from "@/components/ui/button";

const timeframes = ["All", "1H", "4H", "D"];
const verdicts = ["All", "Trade", "No Trade"];

export default function Signals() {
  const [tfFilter, setTfFilter] = useState("All");
  const [verdictFilter, setVerdictFilter] = useState("All");

  const filtered = mockSignals.filter((s) => {
    if (tfFilter !== "All" && s.timeframe !== tfFilter) return false;
    if (verdictFilter === "Trade" && s.verdict !== "trade") return false;
    if (verdictFilter === "No Trade" && s.verdict !== "no_trade") return false;
    return true;
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Signal Explorer</h1>
        <p className="text-sm text-muted-foreground mt-1">Browse AI-generated trade setups</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {timeframes.map((tf) => (
            <Button
              key={tf}
              variant={tfFilter === tf ? "default" : "ghost"}
              size="sm"
              onClick={() => setTfFilter(tf)}
              className="text-xs h-7"
            >
              {tf}
            </Button>
          ))}
        </div>
        <div className="flex gap-1 bg-muted rounded-lg p-1">
          {verdicts.map((v) => (
            <Button
              key={v}
              variant={verdictFilter === v ? "default" : "ghost"}
              size="sm"
              onClick={() => setVerdictFilter(v)}
              className="text-xs h-7"
            >
              {v}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
        {filtered.length === 0 && (
          <p className="text-sm text-muted-foreground col-span-full text-center py-12">
            No signals match your filters.
          </p>
        )}
      </div>
    </div>
  );
}
