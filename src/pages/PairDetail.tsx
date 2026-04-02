import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { ArrowLeft, Star, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { getMarketData, type TrendDirection } from "@/data/mockMarketData";

const TrendCard = ({ label, dir }: { label: string; dir: TrendDirection }) => {
  const Icon = dir === "bullish" ? TrendingUp : dir === "bearish" ? TrendingDown : Minus;
  const color = dir === "bullish" ? "text-bullish" : dir === "bearish" ? "text-bearish" : "text-muted-foreground";
  return (
    <div className="rounded-lg border border-border bg-card p-4 text-center">
      <p className="text-xs text-muted-foreground mb-2">{label}</p>
      <Icon className={`h-5 w-5 mx-auto mb-1 ${color}`} />
      <StatusBadge variant={dir}>{dir}</StatusBadge>
    </div>
  );
};

export default function PairDetail() {
  const { pair } = useParams<{ pair: string }>();
  const decodedPair = decodeURIComponent(pair ?? "");
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const md = getMarketData(decodedPair);

  const { data: watchlist = [] } = useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_watchlist").select("*");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: signals = [], isLoading: loadingSignals } = useQuery({
    queryKey: ["signals-pair", decodedPair],
    queryFn: async () => {
      const { data, error } = await supabase.from("signals").select("*").eq("pair", decodedPair).eq("status", "active");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: journalEntries = [] } = useQuery({
    queryKey: ["journal-pair", decodedPair],
    queryFn: async () => {
      const { data, error } = await supabase.from("trade_journal_entries").select("*").eq("pair", decodedPair).order("opened_at", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const isFav = watchlist.some((w) => w.pair === decodedPair);

  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_watchlist").insert({ user_id: user!.id, pair: decodedPair });
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Added to watchlist"); },
  });

  const removeMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("user_watchlist").delete().eq("user_id", user!.id).eq("pair", decodedPair);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["watchlist"] }); toast.success("Removed from watchlist"); },
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/watchlist")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">{decodedPair}</h1>
          <p className="text-sm text-muted-foreground">Pair Detail</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => isFav ? removeMut.mutate() : addMut.mutate()}
        >
          <Star className={`h-3.5 w-3.5 ${isFav ? "fill-warning text-warning" : ""}`} />
          {isFav ? "Favorited" : "Add to Watchlist"}
        </Button>
      </div>

      {/* Price overview */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Price</p>
          <p className="text-xl font-bold font-mono text-foreground">{md.price.toFixed(md.price > 100 ? 2 : 4)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Spread</p>
          <p className="text-xl font-bold font-mono text-foreground">{md.spread.toFixed(1)}</p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Daily Change</p>
          <p className={`text-xl font-bold font-mono ${md.dailyChangePct > 0 ? "text-bullish" : md.dailyChangePct < 0 ? "text-bearish" : "text-foreground"}`}>
            {md.dailyChangePct > 0 ? "+" : ""}{md.dailyChangePct.toFixed(2)}%
          </p>
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">ATR</p>
          <p className="text-xl font-bold font-mono text-foreground">{md.atr}</p>
          <StatusBadge variant={md.volatility === "High" ? "bearish" : md.volatility === "Med" ? "neutral" : "bullish"} className="mt-1">
            {md.volatility} Vol
          </StatusBadge>
        </div>
      </div>

      {/* Trend + Session + News */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <TrendCard label="H1 Trend" dir={md.trendH1} />
        <TrendCard label="H4 Trend" dir={md.trendH4} />
        <TrendCard label="D1 Trend" dir={md.trendD1} />
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">Session</p>
          <StatusBadge variant={md.activeSession === "Closed" ? "expired" : "active"}>{md.activeSession}</StatusBadge>
        </div>
        <div className="rounded-lg border border-border bg-card p-4 text-center">
          <p className="text-xs text-muted-foreground mb-2">News Risk</p>
          {md.newsRisk ? (
            <div className="flex items-center justify-center gap-1 text-warning">
              <AlertTriangle className="h-4 w-4" />
              <span className="text-xs font-semibold">HIGH</span>
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">None</span>
          )}
        </div>
      </div>

      {/* Active Signals */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Active Signals</h2>
        </div>
        {loadingSignals ? (
          <div className="p-4 space-y-2">{[1, 2].map((i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
        ) : signals.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No active signals for {decodedPair}</p>
        ) : (
          <div className="divide-y divide-border">
            {signals.map((s) => (
              <div key={s.id} className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/signals/${s.id}`)}>
                <div className="flex items-center gap-3">
                  <StatusBadge variant={s.direction === "long" ? "bullish" : "bearish"}>{s.direction}</StatusBadge>
                  <span className="text-sm text-foreground">{s.setup_type ?? s.timeframe}</span>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-muted-foreground">Entry: <span className="text-foreground font-mono">{Number(s.entry_price).toFixed(md.price > 100 ? 2 : 4)}</span></span>
                  <span className="text-muted-foreground">Conf: <span className="text-foreground font-semibold">{s.confidence}%</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Journal Entries */}
      <div className="rounded-lg border border-border bg-card">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Journal Entries</h2>
        </div>
        {journalEntries.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">No journal entries for {decodedPair} yet</p>
        ) : (
          <div className="divide-y divide-border">
            {journalEntries.map((j) => (
              <div key={j.id} className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <StatusBadge variant={j.direction === "long" ? "bullish" : "bearish"}>{j.direction}</StatusBadge>
                  <span className="text-sm text-foreground">{new Date(j.opened_at).toLocaleDateString()}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <StatusBadge variant={j.status === "open" ? "active" : j.result_pips && Number(j.result_pips) >= 0 ? "bullish" : "bearish"}>
                    {j.status === "open" ? "Open" : `${Number(j.result_pips ?? 0) >= 0 ? "+" : ""}${j.result_pips ?? 0} pips`}
                  </StatusBadge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Chart Placeholder */}
      <div className="rounded-lg border border-border bg-card p-8 text-center">
        <BarChart3 className="h-10 w-10 mx-auto mb-2 text-muted-foreground opacity-40" />
        <p className="text-sm font-medium text-muted-foreground">Chart coming soon</p>
        <p className="text-xs text-muted-foreground mt-1">Price action and indicator overlays will appear here</p>
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ Prices are indicative only. Not financial advice. Trading carries risk.
      </p>
    </div>
  );
}
