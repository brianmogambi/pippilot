import { useState, useMemo } from "react";
import { Star, Plus, Search, AlertTriangle, TrendingUp, TrendingDown, Minus, ArrowRight } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import StatusBadge from "@/components/ui/status-badge";
import { toast } from "sonner";
import { getMarketData, type TrendDirection, type VolatilityLevel, type SessionName } from "@/data/mockMarketData";

const TrendIcon = ({ dir }: { dir: TrendDirection }) => {
  if (dir === "bullish") return <TrendingUp className="h-3 w-3 text-bullish" />;
  if (dir === "bearish") return <TrendingDown className="h-3 w-3 text-bearish" />;
  return <Minus className="h-3 w-3 text-muted-foreground" />;
};

export default function Watchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [newPair, setNewPair] = useState("");
  const [favOnly, setFavOnly] = useState(false);
  const [filterSignal, setFilterSignal] = useState("all");
  const [filterSession, setFilterSession] = useState("all");
  const [filterTrend, setFilterTrend] = useState("all");
  const [filterVol, setFilterVol] = useState("all");

  const { data: instruments = [], isLoading: loadingInstruments } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instruments").select("symbol").eq("is_active", true).order("symbol");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_watchlist").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: activeSignals = [] } = useQuery({
    queryKey: ["signals-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("signals").select("pair, id, direction, confidence").eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const favSet = useMemo(() => new Set(watchlist.map((w) => w.pair)), [watchlist]);
  const signalMap = useMemo(() => {
    const m: Record<string, { id: string; direction: string; confidence: number }> = {};
    activeSignals.forEach((s) => { if (!m[s.pair]) m[s.pair] = s; });
    return m;
  }, [activeSignals]);

  const addMutation = useMutation({
    mutationFn: async (pair: string) => {
      const { error } = await supabase.from("user_watchlist").insert({ user_id: user!.id, pair });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); setNewPair(""); toast.success("Added to watchlist"); },
    onError: () => toast.error("Failed to add"),
  });

  const removeMutation = useMutation({
    mutationFn: async (pair: string) => {
      const { error } = await supabase.from("user_watchlist").delete().eq("user_id", user!.id).eq("pair", pair);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Removed from watchlist"); },
  });

  const toggleFav = (symbol: string) => {
    if (favSet.has(symbol)) removeMutation.mutate(symbol);
    else addMutation.mutate(symbol);
  };

  const availableForAdd = instruments.filter((i) => !favSet.has(i.symbol));

  const rows = useMemo(() => {
    let list = instruments.map((i) => {
      const md = getMarketData(i.symbol);
      const sig = signalMap[i.symbol];
      return { symbol: i.symbol, isFav: favSet.has(i.symbol), ...md, signal: sig ?? null };
    });

    if (search) list = list.filter((r) => r.symbol.toLowerCase().includes(search.toLowerCase()));
    if (favOnly) list = list.filter((r) => r.isFav);
    if (filterSignal === "active") list = list.filter((r) => r.signal);
    if (filterSignal === "none") list = list.filter((r) => !r.signal);
    if (filterSession !== "all") list = list.filter((r) => r.activeSession === filterSession);
    if (filterTrend !== "all") list = list.filter((r) => r.trendH4 === filterTrend);
    if (filterVol !== "all") list = list.filter((r) => r.volatility === filterVol);

    return list;
  }, [instruments, search, favOnly, filterSignal, filterSession, filterTrend, filterVol, favSet, signalMap]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Market Watch</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Monitor instruments, trends, and trading opportunities</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={newPair} onValueChange={setNewPair}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Add pair…" /></SelectTrigger>
            <SelectContent>
              {availableForAdd.map((i) => <SelectItem key={i.symbol} value={i.symbol}>{i.symbol}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1" disabled={!newPair || addMutation.isPending} onClick={() => addMutation.mutate(newPair)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      {/* Search + Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative w-full sm:w-52">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Search pairs…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-9 pl-8 text-sm" />
        </div>
        <Button size="sm" variant={favOnly ? "default" : "outline"} className="h-9 gap-1 text-xs" onClick={() => setFavOnly(!favOnly)}>
          <Star className={`h-3 w-3 ${favOnly ? "fill-current" : ""}`} /> Favorites
        </Button>
        <Select value={filterSignal} onValueChange={setFilterSignal}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Signals</SelectItem>
            <SelectItem value="active">Has Signal</SelectItem>
            <SelectItem value="none">No Signal</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Sessions</SelectItem>
            <SelectItem value="London">London</SelectItem>
            <SelectItem value="New York">New York</SelectItem>
            <SelectItem value="Asia">Asia</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterTrend} onValueChange={setFilterTrend}>
          <SelectTrigger className="h-9 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Trends</SelectItem>
            <SelectItem value="bullish">Bullish</SelectItem>
            <SelectItem value="bearish">Bearish</SelectItem>
            <SelectItem value="neutral">Neutral</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterVol} onValueChange={setFilterVol}>
          <SelectTrigger className="h-9 w-28 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vol</SelectItem>
            <SelectItem value="Low">Low</SelectItem>
            <SelectItem value="Med">Medium</SelectItem>
            <SelectItem value="High">High</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        {loadingInstruments ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Search className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium">No instruments match your filters</p>
            <p className="text-xs mt-1">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-10"></TableHead>
                  <TableHead>Pair</TableHead>
                  <TableHead className="text-right">Price</TableHead>
                  <TableHead className="text-right">Spread</TableHead>
                  <TableHead className="text-right">Change</TableHead>
                  <TableHead className="text-center">Volatility</TableHead>
                  <TableHead className="text-center">Session</TableHead>
                  <TableHead className="text-center">Trend</TableHead>
                  <TableHead className="text-center">Signal</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow
                    key={r.symbol}
                    className="cursor-pointer group"
                    onClick={() => navigate(`/watchlist/${encodeURIComponent(r.symbol)}`)}
                  >
                    <TableCell className="pr-0">
                      <button
                        onClick={(e) => { e.stopPropagation(); toggleFav(r.symbol); }}
                        className="p-1 rounded hover:bg-accent transition-colors"
                      >
                        <Star className={`h-3.5 w-3.5 ${r.isFav ? "fill-warning text-warning" : "text-muted-foreground"}`} />
                      </button>
                    </TableCell>
                    <TableCell className="font-semibold text-foreground">{r.symbol}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-foreground">{r.price.toFixed(r.price > 100 ? 2 : 4)}</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{r.spread.toFixed(1)}</TableCell>
                    <TableCell className="text-right">
                      <span className={`text-sm font-medium ${r.dailyChangePct > 0 ? "text-bullish" : r.dailyChangePct < 0 ? "text-bearish" : "text-muted-foreground"}`}>
                        {r.dailyChangePct > 0 ? "+" : ""}{r.dailyChangePct.toFixed(2)}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge variant={r.volatility === "High" ? "bearish" : r.volatility === "Med" ? "neutral" : "bullish"}>
                        {r.volatility}
                      </StatusBadge>
                    </TableCell>
                    <TableCell className="text-center">
                      <StatusBadge variant={r.activeSession === "Closed" ? "expired" : "active"}>
                        {r.activeSession}
                      </StatusBadge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center justify-center gap-1">
                        <TrendIcon dir={r.trendH1} />
                        <TrendIcon dir={r.trendH4} />
                        <TrendIcon dir={r.trendD1} />
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {r.signal ? (
                        <StatusBadge variant={r.signal.direction === "long" ? "bullish" : "bearish"}>
                          {r.signal.direction === "long" ? "▲" : "▼"} {r.signal.confidence}%
                        </StatusBadge>
                      ) : (
                        <span className="text-[10px] text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="pl-0">
                      {r.newsRisk ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-warning" />
                      ) : (
                        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ Prices are indicative only. Not financial advice. Trading carries risk.
      </p>
    </div>
  );
}
