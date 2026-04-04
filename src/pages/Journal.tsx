import { useState, useMemo } from "react";
import { BookOpen, ArrowUpRight, ArrowDownRight, Trophy, Target, CheckCircle2, XCircle, Star, TrendingUp, TrendingDown, BarChart3, PlusCircle } from "lucide-react";
import { useJournalEntries, useJournalStats } from "@/hooks/use-journal";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import EmptyState from "@/components/ui/empty-state";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JournalEntryForm from "@/components/journal/JournalEntryForm";
import JournalFilters, { defaultFilters, type JournalFiltersState } from "@/components/journal/JournalFilters";
import JournalDetailDrawer from "@/components/journal/JournalDetailDrawer";
import { Skeleton } from "@/components/ui/skeleton";

export default function Journal() {
  const [filters, setFilters] = useState<JournalFiltersState>(defaultFilters);
  const [selectedEntry, setSelectedEntry] = useState<any | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editEntry, setEditEntry] = useState<any | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const { data: entries = [], isLoading, refetch } = useJournalEntries();
  const stats = useJournalStats(entries);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filters.pair && e.pair !== filters.pair) return false;
      if (filters.setupType && e.setup_type !== filters.setupType) return false;
      if (filters.result === "win" && !((Number(e.result_pips) ?? 0) > 0)) return false;
      if (filters.result === "loss" && !((Number(e.result_pips) ?? 0) < 0)) return false;
      if (filters.dateFrom && new Date(e.opened_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && new Date(e.opened_at) > new Date(filters.dateTo + "T23:59:59")) return false;
      return true;
    });
  }, [entries, filters]);

  const handleRowClick = (entry: any) => {
    setSelectedEntry(entry);
    setDrawerOpen(true);
  };

  const handleEdit = (entry: any) => {
    setEditEntry(entry);
    setEditOpen(true);
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">Track, review, and learn from your trading performance</p>
        </div>
        <JournalEntryForm onSuccess={refetch} open={formOpen} onOpenChange={setFormOpen} />
      </div>

      {/* 6 stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Total Trades" value={String(stats.totalTrades)} icon={BookOpen} iconColor="text-primary" />
        <StatCard label="Win Rate" value={`${stats.winRate}%`} icon={Trophy} iconColor="text-bullish" trend={{ value: `${stats.wins}W / ${stats.totalTrades - stats.wins}L`, positive: stats.winRate >= 50 }} />
        <StatCard label="Avg R-Multiple" value={stats.avgR} icon={BarChart3} iconColor="text-primary" />
        <StatCard label="Avg Pips" value={stats.avgPips} icon={Target} iconColor="text-warning" />
        <StatCard label="Best Pair" value={stats.bestPair} icon={TrendingUp} iconColor="text-bullish" />
        <StatCard label="Worst Pair" value={stats.worstPair} icon={TrendingDown} iconColor="text-bearish" />
      </div>

      {/* Filters */}
      <JournalFilters filters={filters} onChange={setFilters} />

      {/* Journal table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title={entries.length === 0 ? "Start your trading journal" : "No entries match your filters"}
            description={entries.length === 0 ? "Log your first trade to start tracking your performance and building better habits." : "Try adjusting your filters to see more entries."}
            actionLabel={entries.length === 0 ? "Add First Trade" : undefined}
            onAction={entries.length === 0 ? () => setFormOpen(true) : undefined}
          />
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="sticky top-0 z-10">
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Pair</TableHead>
                  <TableHead className="text-xs">Direction</TableHead>
                  <TableHead className="text-xs">Setup</TableHead>
                  <TableHead className="text-xs text-right">Entry</TableHead>
                  <TableHead className="text-xs text-right">Exit</TableHead>
                  <TableHead className="text-xs text-right">P&L (pips)</TableHead>
                  <TableHead className="text-xs text-right">P&L ($)</TableHead>
                  <TableHead className="text-xs text-center">Confidence</TableHead>
                  <TableHead className="text-xs text-center">Plan</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((entry) => (
                  <TableRow key={entry.id} className="cursor-pointer hover:bg-muted/40 transition-colors" onClick={() => handleRowClick(entry)}>
                    <TableCell className="text-muted-foreground text-xs">{new Date(entry.opened_at).toLocaleDateString()}</TableCell>
                    <TableCell className="font-medium text-foreground">{entry.pair}</TableCell>
                    <TableCell>
                      <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
                        {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                        {entry.direction}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground capitalize">{entry.setup_type?.replace("_", " ") ?? "—"}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{entry.entry_price}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{entry.exit_price ?? "—"}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-semibold ${(Number(entry.result_pips) ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {entry.result_pips != null ? `${Number(entry.result_pips) >= 0 ? "+" : ""}${entry.result_pips}` : "—"}
                    </TableCell>
                    <TableCell className={`text-right font-mono text-xs ${(Number(entry.result_amount) ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                      {entry.result_amount != null ? `$${entry.result_amount}` : "—"}
                    </TableCell>
                    <TableCell className="text-center">
                      {entry.confidence ? (
                        <div className="flex items-center justify-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < entry.confidence! ? "text-warning fill-warning" : "text-muted-foreground/20"}`} />
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

      {/* Detail drawer */}
      <JournalDetailDrawer entry={selectedEntry} open={drawerOpen} onOpenChange={setDrawerOpen} onEdit={handleEdit} />

      {/* Edit form (controlled) */}
      <JournalEntryForm onSuccess={refetch} entry={editEntry} open={editOpen} onOpenChange={(o) => { setEditOpen(o); if (!o) setEditEntry(null); }} />
    </div>
  );
}
