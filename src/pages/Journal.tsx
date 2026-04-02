import { BookOpen, ArrowUpRight, ArrowDownRight, Trophy, Target, CheckCircle2, XCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import JournalEntryForm from "@/components/journal/JournalEntryForm";
import { Skeleton } from "@/components/ui/skeleton";

export default function Journal() {
  const { user } = useAuth();

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

  const closedEntries = entries.filter((e) => e.status === "closed" && e.result_pips != null);
  const totalTrades = closedEntries.length;
  const wins = closedEntries.filter((e) => (e.result_pips ?? 0) > 0).length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const avgPips = totalTrades > 0 ? (closedEntries.reduce((a, e) => a + (e.result_pips ?? 0), 0) / totalTrades).toFixed(1) : "0";

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and review your trading performance</p>
        </div>
        <JournalEntryForm onSuccess={refetch} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Trades" value={String(totalTrades)} icon={BookOpen} iconColor="text-primary" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={Trophy} iconColor="text-bullish" trend={{ value: `${wins}W / ${totalTrades - wins}L`, positive: winRate >= 50 }} />
        <StatCard label="Avg Pips" value={avgPips} icon={Target} iconColor="text-warning" />
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <BookOpen className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No journal entries yet. Add your first trade!</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Pair</TableHead>
                <TableHead>Direction</TableHead>
                <TableHead className="text-right">Entry</TableHead>
                <TableHead className="text-right">Exit</TableHead>
                <TableHead className="text-right">P&L (pips)</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead className="hidden lg:table-cell">Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-muted-foreground text-sm">{new Date(entry.opened_at).toLocaleDateString()}</TableCell>
                  <TableCell className="font-medium text-foreground">{entry.pair}</TableCell>
                  <TableCell>
                    <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
                      {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                      {entry.direction}
                    </StatusBadge>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{entry.entry_price}</TableCell>
                  <TableCell className="text-right font-mono text-sm">{entry.exit_price ?? "—"}</TableCell>
                  <TableCell className={`text-right font-mono text-sm font-semibold ${(entry.result_pips ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                    {entry.result_pips != null ? `${entry.result_pips >= 0 ? "+" : ""}${entry.result_pips}` : "—"}
                  </TableCell>
                  <TableCell>
                    {entry.followed_plan ? (
                      <CheckCircle2 className="h-4 w-4 text-bullish" />
                    ) : (
                      <XCircle className="h-4 w-4 text-bearish" />
                    )}
                  </TableCell>
                  <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{entry.notes ?? ""}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ AI-assisted analysis only. Past performance is not indicative of future results.
      </p>
    </div>
  );
}
