import { Eye, Plus, Trash2, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { mockWatchlistData } from "@/data/mockSignals";
import StatusBadge from "@/components/ui/status-badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function Watchlist() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your favorite currency pairs</p>
        </div>
        <div className="flex items-center gap-2">
          <Input placeholder="Add pair…" className="w-32 h-9 text-sm" />
          <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add</Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Pair</TableHead>
              <TableHead className="text-right">Price</TableHead>
              <TableHead className="text-right">Daily Change</TableHead>
              <TableHead>Signal</TableHead>
              <TableHead className="w-12"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockWatchlistData.map((item) => {
              const positive = item.dailyChange >= 0;
              return (
                <TableRow key={item.pair}>
                  <TableCell className="font-medium text-foreground flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    {item.pair}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">{item.price}</TableCell>
                  <TableCell className="text-right">
                    <span className={`inline-flex items-center gap-1 text-sm ${positive ? "text-bullish" : "text-bearish"}`}>
                      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {positive ? "+" : ""}{item.dailyChangePct.toFixed(2)}%
                    </span>
                  </TableCell>
                  <TableCell>
                    <StatusBadge variant={item.signalStatus === "active" ? "active" : "neutral"}>
                      {item.signalStatus === "active" ? "Active" : "None"}
                    </StatusBadge>
                  </TableCell>
                  <TableCell>
                    <button className="p-1 rounded hover:bg-accent transition-colors">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-bearish" />
                    </button>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ Prices are indicative only. Not financial advice. Trading carries risk.
      </p>
    </div>
  );
}
