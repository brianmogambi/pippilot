import { useState, useMemo } from "react";
import { BookOpen, ArrowUpRight, ArrowDownRight, Trophy, Target, CheckCircle2, XCircle, Star, TrendingUp, TrendingDown, BarChart3 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JournalEntryForm from "@/components/journal/JournalEntryForm";
import JournalFilters, { defaultFilters, type JournalFiltersState } from "@/components/journal/JournalFilters";
import JournalDetailDrawer from "@/components/journal/JournalDetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Journal() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<JournalFiltersState>(defaultFilters);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);

  const { data: entries = [], isLoading, refetch } = useQuery({
    queryKey: ["journal-entries", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trade_journal_entries")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Filter entries
  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.pair && e.pair !== filters.pair) return false;
      if (filters.setupType && e.setup_type !== filters.setupType) return false;
      if (filters.result === "win" && !((e.result_pips ?? 0) > 0)) return false;
      if (filters.result === "loss" && !((e.result_pips ?? 0) < 0)) return false;
      if (filters.dateFrom && new Date(e.opened_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(e.opened_at) > new Date(filters.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [entries, filters]);

  // Stats from closed entries (unfiltered for overall performance)
  const closedEntries = entries.filter((e) => e.status === "closed" && e.result_pips != null);
  const totalTrades = closedEntries.length;
  const wins = closedEntries.filter((e) => (e.result_pips ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const avgPips = totalTrades > 0 ? (closedEntries.reduce((a, e) => a + (e.result_pips ?? 0), 0) / totalTrades).toFixed(1) : "0";

  // Avg R-Multiple: result_pips / |entry_price - stop_loss| (in pips proxy)
  const rEntries = closedEntries.filter((e) => e.stop_loss != null && e.result_pips != null);
  const avgR = rEntries.length > 0
    ? (rEntries.reduce((a, e) => {
        const slDist = Math.abs(e.entry_price - (e.stop_loss ?? e.entry_price));
        return a + (slDist > 0 ? (e.result_pips ?? 0) / (slDist * 10000) : 0);
      }, 0) / rEntries.length).toFixed(2)
    : "—";

  // Best / Worst pair
  const pairStats = closedEntries.reduce<Record<string, { total: number; count: number }>>((acc, e) => {
    if (!acc[e.pair]) acc[e.pair] = { total: 0, count: 0 };
    acc[e.pair].total += e.result_pips ?? 0;
    acc[e.pair].count += 1;
    return acc;
  }, {});
  const pairAvgs = Object.entries(pairStats).map(([pair, s]) => ({ pair, avg: s.total / s.count }));
  pairAvgs.sort((a, b) => b.avg - a.avg);
  const bestPair = pairAvgs[0]?.pair ?? "—";
  const worstPair = pairAvgs[pairAvgs.length - 1]?.pair ?? "—";

  const handleRowClick = (entry: any) => {
    setSelectedEntry(entry);
    setDrawerOpen(true);
  };

  const handleEdit = (entry: any) => {
    setEditEntry(entry);
    setEditOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">Track, review, and learn from your trading performance</p>
        </div>
        <JournalEntryForm onSuccess={refetch} />
      </div>

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Trades" value={String(totalTrades)} icon={BookOpen} iconColor="text-primary" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={Trophy} iconColor="text-bullish" trend={{ value: `${wins}W / ${totalTrades - wins}L`, positive: winRate >= 50 }} />
        <StatCard label="Avg R-Multiple" value={avgR} icon={BarChart3} iconColor="text-primary" />
        <StatCard label="Avg Pips" value={avgPips} icon={Target} iconColor="text-warning" />
        <StatCard label="Best Pair" value={bestPair} icon={TrendingUp} iconColor="text-bullish" />
        <StatCard label="Worst Pair" value={worstPair} icon={TrendingDown} iconColor="text-bearish" />
      </div>

      {/* Filters */}
      <JournalFilters filters={filters} onChange={setFilters} />

      {/* Journal table */}
      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">{entries.length === 0 ? "No journal entries yet. Add your first trade!" : "No entries match your filters."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead>Direction</TableHead>
                  <TableHead>Setup</TableHead>
                  <TableHead className="text-right">Entry</TableHead>
                  <TableHead className="text-right">Exit</TableHead>
                  <TableHead className="text-right">P&L (pips)</TableHead>
                  <TableHead className="text-right">P&L ($)</TableHead>
                  <TableHead className="text-center">Confidence</TableHead>
                  <TableHead className="text-center">Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleRowClick(entry)}>
                    <TableCell className="text-muted-foreground text-sm">{new Date(entry.opened_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-foreground">{entry.pair}</TableCell>
                    <TableCell>
                      <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
                        {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                        {entry.direction}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{entry.setup_type?.replace("_", " ") ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{entry.entry_price}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{entry.exit_price ?? "—"}</TableCell>
                    <TableCell className={`text-right font-mono text-sm font-semibold ${(entry.result_pips ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {entry.result_pips != null ? `${entry.result_pips >= 0 ? "+" : ""}${entry.result_pips}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-sm ${(entry.result_amount ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {entry.result_amount != null ? `$${entry.result_amount}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.confidence ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < entry.confidence ? "text-warning fill-warning" : "text-muted-foreground/20"}`} />
                          ))}
                        </div>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.followed_plan ? <CheckCircle2 className="h-4 w-4 text-bullish mx-auto" /> : <XCircle className="h-4 w-4 text-bearish mx-auto" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ AI-assisted analysis only. Past performance is not indicative of future results.
      </p>

      {/* Detail drawer */}
      <JournalDetailDrawer entry={selectedEntry} open={drawerOpen} onOpenChange={setDrawerOpen} onEdit={handleEdit} />

      {/* Edit form (controlled) */}
      <JournalEntryForm onSuccess={refetch} entry={editEntry} open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditEntry(null); }} />
    </div>
  );
}
