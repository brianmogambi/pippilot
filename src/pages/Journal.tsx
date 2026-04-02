import { BookOpen, Plus, ArrowUpRight, ArrowDownRight, Trophy, Target, TrendingUp } from "lucide-react";
import { mockJournalEntries } from "@/data/mockSignals";
import StatusBadge from "@/components/ui/status-badge";
import StatCard from "@/components/ui/stat-card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";

const totalTrades = mockJournalEntries.length;
const wins = mockJournalEntries.filter((e) => e.pnl > 0).length;
const winRate = Math.round((wins / totalTrades) * 100);
const avgRR = (mockJournalEntries.reduce((a, e) => a + e.rr, 0) / totalTrades).toFixed(1);

export default function Journal() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Trade Journal</h1>
          <p className="text-sm text-muted-foreground mt-1">Track and review your trading performance</p>
        </div>
        <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Entry</Button>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Total Trades" value={String(totalTrades)} icon={BookOpen} iconColor="text-primary" />
        <StatCard label="Win Rate" value={`${winRate}%`} icon={Trophy} iconColor="text-bullish" trend={{ value: `${wins}W / ${totalTrades - wins}L`, positive: winRate >= 50 }} />
        <StatCard label="Avg R:R" value={avgRR} icon={Target} iconColor="text-warning" />
      </div>

      {/* Journal Table */}
      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Date</TableHead>
              <TableHead>Pair</TableHead>
              <TableHead>Direction</TableHead>
              <TableHead className="text-right">Entry</TableHead>
              <TableHead className="text-right">Exit</TableHead>
              <TableHead className="text-right">P&L (pips)</TableHead>
              <TableHead className="text-right">R:R</TableHead>
              <TableHead className="hidden lg:table-cell">Notes</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockJournalEntries.map((entry) => (
              <TableRow key={entry.id}>
                <TableCell className="text-muted-foreground text-sm">{entry.date}</TableCell>
                <TableCell className="font-medium text-foreground">{entry.pair}</TableCell>
                <TableCell>
                  <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
                    {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
                    {entry.direction}
                  </StatusBadge>
                </TableCell>
                <TableCell className="text-right font-mono text-sm">{entry.entry_price}</TableCell>
                <TableCell className="text-right font-mono text-sm">{entry.exit_price}</TableCell>
                <TableCell className={`text-right font-mono text-sm font-semibold ${entry.pnl >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {entry.pnl >= 0 ? "+" : ""}{entry.pnl}
                </TableCell>
                <TableCell className="text-right text-sm">{entry.rr.toFixed(1)}</TableCell>
                <TableCell className="hidden lg:table-cell text-xs text-muted-foreground max-w-[200px] truncate">{entry.notes}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ AI-assisted analysis only. Past performance is not indicative of future results.
      </p>
    </div>
  );
}
