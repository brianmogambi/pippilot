import { useState, useMemo } from "react";
import { useSignals, getQualityForSignal } from "@/hooks/use-signals";
import type { EnrichedSignal } from "@/types/trading";
import SignalCard from "@/components/signals/SignalCard";
import SignalDetailDrawer from "@/components/signals/SignalDetailDrawer";
import StatusBadge from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ArrowUpRight, ArrowDownRight, Ban, AlertTriangle, Search, SlidersHorizontal,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

// Re-export for components that import from here
export type { EnrichedSignal } from "@/types/trading";

const timeframes = ["All", "5m", "15m", "1H", "4H", "D"];
const directions = ["All", "Long", "Short"];
const qualities = ["All", "A+", "A", "B", "C"];
const confidenceRanges = ["All", "80%+", "60-79%", "Below 60%"];
const statuses = ["All", "active", "monitoring", "ready", "triggered", "invalidated", "closed"];

export default function Signals() {
  const [pairSearch, setPairSearch] = useState("");
  const [tfFilter, setTfFilter] = useState("All");
  const [dirFilter, setDirFilter] = useState("All");
  const [qualityFilter, setQualityFilter] = useState("All");
  const [confFilter, setConfFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [selectedSignal, setSelectedSignal] = useState<EnrichedSignal | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const { enriched, isLoading } = useSignals();

  const filtered = useMemo(() => {
    return enriched.filter((s) => {
      if (pairSearch && !s.pair.toLowerCase().includes(pairSearch.toLowerCase())) return false;
      if (tfFilter !== "All" && s.timeframe !== tfFilter) return false;
      if (dirFilter !== "All" && s.direction !== dirFilter.toLowerCase()) return false;
      if (qualityFilter !== "All") {
        const q = getQualityForSignal(s.pair);
        if (q !== qualityFilter) return false;
      }
      if (confFilter === "80%+" && s.confidence < 80) return false;
      if (confFilter === "60-79%" && (s.confidence < 60 || s.confidence >= 80)) return false;
      if (confFilter === "Below 60%" && s.confidence >= 60) return false;
      if (statusFilter !== "All" && s.status !== statusFilter) return false;
      return true;
    });
  }, [enriched, pairSearch, tfFilter, dirFilter, qualityFilter, confFilter, statusFilter]);

  const openDrawer = (signal: EnrichedSignal) => {
    setSelectedSignal(signal);
    setDrawerOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Signal Explorer</h1>
          <p className="text-sm text-muted-foreground mt-1">AI-generated trade setups — review, filter, and analyze</p>
        </div>
        <div className="flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/10 px-3 py-1.5">
          <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0" />
          <span className="text-[11px] text-warning font-medium">AI-generated — not financial advice</span>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search pair..."
            value={pairSearch}
            onChange={(e) => setPairSearch(e.target.value)}
            className="h-8 w-36 pl-8 text-xs"
          />
        </div>
        <FilterSelect label="Timeframe" value={tfFilter} onValueChange={setTfFilter} options={timeframes} />
        <FilterSelect label="Direction" value={dirFilter} onValueChange={setDirFilter} options={directions} />
        <FilterSelect label="Quality" value={qualityFilter} onValueChange={setQualityFilter} options={qualities} />
        <FilterSelect label="Confidence" value={confFilter} onValueChange={setConfFilter} options={confidenceRanges} />
        <FilterSelect label="Status" value={statusFilter} onValueChange={setStatusFilter} options={statuses} />
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground hidden md:block" />
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Desktop table */}
      {!isLoading && (
        <div className="hidden md:block rounded-lg border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">Pair</TableHead>
                <TableHead className="text-xs">Direction</TableHead>
                <TableHead className="text-xs">TF</TableHead>
                <TableHead className="text-xs">Setup</TableHead>
                <TableHead className="text-xs text-right">Entry</TableHead>
                <TableHead className="text-xs text-right">SL</TableHead>
                <TableHead className="text-xs text-right">TP1</TableHead>
                <TableHead className="text-xs text-right">R:R</TableHead>
                <TableHead className="text-xs text-center">Conf.</TableHead>
                <TableHead className="text-xs text-center">Quality</TableHead>
                <TableHead className="text-xs text-center">Status</TableHead>
                <TableHead className="text-xs text-right">Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => {
                const isLong = s.direction === "long";
                const isNoTrade = s.verdict === "no_trade";
                const quality = getQualityForSignal(s.pair);
                return (
                  <TableRow
                    key={s.id}
                    className="cursor-pointer hover:bg-muted/40 transition-colors"
                    onClick={() => openDrawer(s)}
                  >
                    <TableCell className="font-semibold text-foreground text-sm py-3">{s.pair}</TableCell>
                    <TableCell className="py-3">
                      {isNoTrade ? (
                        <span className="flex items-center gap-1 text-xs text-warning">
                          <Ban className="h-3 w-3" /> Skip
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-medium ${isLong ? "text-bullish" : "text-bearish"}`}>
                          {isLong ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {isLong ? "Long" : "Short"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3">{s.timeframe}</TableCell>
                    <TableCell className="text-xs text-muted-foreground py-3">{s.setup_type || "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs py-3">{s.entry_price}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-bearish py-3">{s.stop_loss}</TableCell>
                    <TableCell className="text-right font-mono text-xs text-bullish py-3">{s.take_profit_1}</TableCell>
                    <TableCell className="text-right font-mono text-xs py-3">{s.riskReward}R</TableCell>
                    <TableCell className="text-center py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <div className="w-10 bg-muted rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${s.confidence >= 70 ? "bg-bullish" : s.confidence >= 50 ? "bg-warning" : "bg-bearish"}`}
                            style={{ width: `${s.confidence}%` }}
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground w-7">{s.confidence}%</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-center py-3">
                      {quality ? (
                        <StatusBadge variant={quality === "A+" || quality === "A" ? "bullish" : quality === "B" ? "neutral" : "bearish"}>
                          {quality}
                        </StatusBadge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-center py-3">
                      <StatusBadge
                        variant={
                          s.status === "active" ? "active"
                          : s.status === "triggered" ? "triggered"
                          : s.status === "invalidated" ? "bearish"
                          : s.status === "closed" ? "expired"
                          : "pending"
                        }
                      >
                        {s.status}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-right text-[11px] text-muted-foreground py-3 whitespace-nowrap">
                      {formatDistanceToNow(new Date(s.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
          {filtered.length === 0 && (
            <div className="text-center py-16 text-muted-foreground text-sm">
              {enriched.length === 0 ? "No signals available yet." : "No signals match your filters."}
            </div>
          )}
        </div>
      )}

      {/* Mobile cards */}
      {!isLoading && (
        <div className="grid gap-3 md:hidden">
          {filtered.map((signal) => (
            <div key={signal.id} onClick={() => openDrawer(signal)} className="cursor-pointer">
              <SignalCard signal={signal} />
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-12">
              {enriched.length === 0 ? "No signals available yet." : "No signals match your filters."}
            </p>
          )}
        </div>
      )}

      {/* Detail drawer */}
      <SignalDetailDrawer
        signal={selectedSignal}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </div>
  );
}

function FilterSelect({
  label, value, onValueChange, options,
}: {
  label: string; value: string; onValueChange: (v: string) => void; options: string[];
}) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="h-8 w-auto min-w-[100px] text-xs gap-1">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt} className="text-xs">
            {opt === "All" ? `${label}: All` : opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
