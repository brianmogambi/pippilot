import { useParams, useNavigate } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, Star, AlertTriangle, TrendingUp, TrendingDown, Minus, BarChart3, Ban, Bell, BellOff, Activity, Layers, Zap, CheckCircle2, XCircle, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import StatusBadge from "@/components/ui/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { useMarketData, usePairAnalysis } from "@/hooks/use-market-data";
import { useWatchlist, useAddToWatchlist, useRemoveFromWatchlist } from "@/hooks/use-watchlist";
import { useSignalsByPair } from "@/hooks/use-signals";
import { useJournalByPair } from "@/hooks/use-journal";
import type { TrendDirection, MarketStructure } from "@/types/trading";

/* ───────────── small sub-components ───────────── */

const TrendIcon = ({ dir }: { dir: TrendDirection }) => {
  const Icon = dir === "bullish" ? TrendingUp : dir === "bearish" ? TrendingDown : Minus;
  const color = dir === "bullish" ? "text-bullish" : dir === "bearish" ? "text-bearish" : "text-muted-foreground";
  return <Icon className={`h-4 w-4 ${color}`} />;
};

const BiasCard = ({ label, icon: IconComp, children }: { label: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="rounded-lg border border-border bg-card p-3">
    <div className="flex items-center gap-1.5 mb-2">
      <IconComp className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
    </div>
    {children}
  </div>
);

const LevelRow = ({ label, value, color = "text-foreground" }: { label: string; value: string; color?: string }) => (
  <div className="flex items-center justify-between py-1.5">
    <span className="text-xs text-muted-foreground">{label}</span>
    <span className={`text-xs font-mono font-semibold ${color}`}>{value}</span>
  </div>
);

/* ───────────── main component ───────────── */

export default function PairDetail() {
  const { pair } = useParams<{ pair: string }>();
  const decodedPair = decodeURIComponent(pair ?? "");
  const navigate = useNavigate();
  const md = useMarketData(decodedPair);
  const analysis = usePairAnalysis(decodedPair);
  const [timeframe, setTimeframe] = useState("1H");
  const [alerts, setAlerts] = useState({ entry: false, confirmation: false, tpsl: false });
  const fmt = (v: number) => v.toFixed(md.price > 100 ? 2 : 4);

  /* ── queries via hooks ── */
  const { data: watchlist = [] } = useWatchlist();
  const { data: signals = [], isLoading: loadingSignals } = useSignalsByPair(decodedPair);
  const { data: journalEntries = [] } = useJournalByPair(decodedPair);

  const isFav = watchlist.some((w) => w.pair === decodedPair);
  const addMut = useAddToWatchlist();
  const removeMut = useRemoveFromWatchlist();

  const toggleAlert = (key: keyof typeof alerts) => {
    setAlerts((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      toast.success(next[key] ? "Alert enabled" : "Alert disabled");
      return next;
    });
  };

  const structureLabel: Record<MarketStructure, string> = { trending: "Trending", ranging: "Ranging", breakout: "Breakout" };
  const structureVariant = (s: MarketStructure) => s === "trending" ? "bullish" as const : s === "breakout" ? "neutral" as const : "bearish" as const;

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 pb-mobile-nav">
      {/* ───── Section 1 — Header ───── */}
      <div className="flex flex-wrap items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/watchlist")}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl font-bold text-foreground truncate">{decodedPair}</h1>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono font-bold text-lg text-foreground">{fmt(md.price)}</span>
          <span className="text-muted-foreground">Spd: {md.spread.toFixed(1)}</span>
          <span className={md.dailyChangePct > 0 ? "text-bullish" : md.dailyChangePct < 0 ? "text-bearish" : "text-muted-foreground"}>
            {md.dailyChangePct > 0 ? "+" : ""}{md.dailyChangePct.toFixed(2)}%
          </span>
          <StatusBadge variant={md.activeSession === "Closed" ? "expired" : "active"} className="text-[10px]">{md.activeSession}</StatusBadge>
          {md.newsRisk && <AlertTriangle className="h-4 w-4 text-warning" />}
        </div>
        <Button variant="outline" size="sm" className="gap-1.5" onClick={() => isFav ? removeMut.mutate(decodedPair) : addMut.mutate(decodedPair)}>
          <Star className={`h-3.5 w-3.5 ${isFav ? "fill-warning text-warning" : ""}`} />
          {isFav ? "Favorited" : "Favorite"}
        </Button>
      </div>

      {/* ───── Two-column layout ───── */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5">
        {/* ═══ LEFT COLUMN ═══ */}
        <div className="space-y-5">
          {/* Section 2 — Chart Area */}
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <div className="flex items-center justify-between p-3 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Chart</h2>
              <ToggleGroup type="single" value={timeframe} onValueChange={(v) => v && setTimeframe(v)} size="sm" className="gap-0.5">
                {["5m", "15m", "1H", "4H", "1D"].map((tf) => (
                  <ToggleGroupItem key={tf} value={tf} className="text-xs px-2.5 h-7 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground">
                    {tf}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
            </div>
            <div className="aspect-video flex flex-col items-center justify-center bg-muted/10 border-2 border-dashed border-border/50 rounded-b-lg">
              <BarChart3 className="h-12 w-12 text-muted-foreground/20 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Chart coming soon</p>
              <p className="text-[11px] text-muted-foreground/60 mt-0.5">TradingView integration with indicator overlays</p>
            </div>
          </div>

          {/* Section 4 — Key Levels */}
          <div className="rounded-lg border border-border bg-card p-4">
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-1.5"><Target className="h-4 w-4 text-primary" /> Key Levels</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">
              <div className="divide-y divide-border">
                <LevelRow label="Support" value={fmt(md.supportLevel)} color="text-bullish" />
                <LevelRow label="Resistance" value={fmt(md.resistanceLevel)} color="text-bearish" />
                <LevelRow label="Session High" value={fmt(md.sessionHigh)} />
              </div>
              <div className="divide-y divide-border">
                <LevelRow label="Session Low" value={fmt(md.sessionLow)} />
                <LevelRow label="Prev Day High" value={fmt(md.prevDayHigh)} />
                <LevelRow label="Prev Day Low" value={fmt(md.prevDayLow)} />
              </div>
            </div>
          </div>

          {/* Section 5 — Setup Card */}
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-semibold text-foreground">Setup Analysis</h2>
            </div>
            {!analysis ? (
              <div className="p-8 text-center">
                <Layers className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">No setup analysis available for {decodedPair}</p>
              </div>
            ) : analysis.verdict === "no_trade" ? (
              <div className="p-6 text-center space-y-3">
                <div className="inline-flex items-center justify-center h-12 w-12 rounded-full bg-destructive/10 mx-auto">
                  <Ban className="h-6 w-6 text-destructive" />
                </div>
                <p className="text-base font-semibold text-foreground">No Trade Recommended</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">{analysis.noTradeReason}</p>
                <StatusBadge variant="expired" className="text-xs">Quality: {analysis.setupQuality}</StatusBadge>
              </div>
            ) : (
              <div className="p-4 space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge variant={analysis.direction === "long" ? "bullish" : "bearish"} className="text-xs">{analysis.direction.toUpperCase()}</StatusBadge>
                  <span className="text-sm font-semibold text-foreground">{analysis.setupType}</span>
                  <StatusBadge variant={analysis.setupQuality === "A+" || analysis.setupQuality === "A" ? "bullish" : analysis.setupQuality === "B" ? "neutral" : "bearish"} className="ml-auto text-xs">
                    Quality: {analysis.setupQuality}
                  </StatusBadge>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div><p className="text-muted-foreground mb-0.5">Entry Zone</p><p className="font-mono font-semibold text-foreground">{fmt(analysis.entryZone[0])} – {fmt(analysis.entryZone[1])}</p></div>
                  <div><p className="text-muted-foreground mb-0.5">Stop Loss</p><p className="font-mono font-semibold text-bearish">{fmt(analysis.stopLoss)}</p></div>
                  <div><p className="text-muted-foreground mb-0.5">TP1 / TP2</p><p className="font-mono font-semibold text-bullish">{fmt(analysis.tp1)} / {fmt(analysis.tp2)}</p></div>
                  <div><p className="text-muted-foreground mb-0.5">TP3</p><p className="font-mono font-semibold text-bullish">{fmt(analysis.tp3)}</p></div>
                </div>
                <div>
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-muted-foreground">Confidence</span>
                    <span className="font-semibold text-foreground">{analysis.confidence}%</span>
                  </div>
                  <Progress value={analysis.confidence} className="h-2" />
                </div>
                <div className="text-xs">
                  <p className="text-muted-foreground mb-0.5">Invalidation</p>
                  <p className="text-foreground">{analysis.invalidation}</p>
                </div>
              </div>
            )}
          </div>

          {/* Active Signals (from DB) */}
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Active Signals</h2></div>
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
                      <span className="text-muted-foreground">Entry: <span className="text-foreground font-mono">{fmt(Number(s.entry_price))}</span></span>
                      <span className="text-muted-foreground">Conf: <span className="text-foreground font-semibold">{s.confidence}%</span></span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Recent Journal Entries */}
          <div className="rounded-lg border border-border bg-card">
            <div className="p-4 border-b border-border"><h2 className="text-sm font-semibold text-foreground">Recent Journal Entries</h2></div>
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
                    <StatusBadge variant={j.status === "open" ? "active" : Number(j.result_pips ?? 0) >= 0 ? "bullish" : "bearish"}>
                      {j.status === "open" ? "Open" : `${Number(j.result_pips ?? 0) >= 0 ? "+" : ""}${j.result_pips ?? 0} pips`}
                    </StatusBadge>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ═══ RIGHT COLUMN ═══ */}
        <div className="space-y-5">
          {/* Section 3 — Multi-Timeframe Bias Summary */}
          <div className="grid grid-cols-2 gap-3">
            <BiasCard label="Higher TF (D1)" icon={TrendingUp}>
              <div className="flex items-center gap-1.5">
                <TrendIcon dir={md.trendD1} />
                <StatusBadge variant={md.trendD1}>{md.trendD1}</StatusBadge>
              </div>
            </BiasCard>
            <BiasCard label="Execution (H1)" icon={Activity}>
              <div className="flex items-center gap-1.5">
                <TrendIcon dir={md.trendH1} />
                <StatusBadge variant={md.trendH1}>{md.trendH1}</StatusBadge>
              </div>
            </BiasCard>
            <BiasCard label="Volatility" icon={Zap}>
              <div className="flex items-center justify-between">
                <StatusBadge variant={md.volatility === "High" ? "bearish" : md.volatility === "Med" ? "neutral" : "bullish"}>{md.volatility}</StatusBadge>
                <span className="text-[11px] font-mono text-muted-foreground">ATR {md.atr}</span>
              </div>
            </BiasCard>
            <BiasCard label="Structure" icon={Layers}>
              <StatusBadge variant={structureVariant(md.marketStructure)}>{structureLabel[md.marketStructure]}</StatusBadge>
            </BiasCard>
          </div>

          {/* Section 6 — AI Explanation */}
          {analysis && (
            <div className="rounded-lg border border-border bg-card">
              <div className="p-4 border-b border-border">
                <h2 className="text-sm font-semibold text-foreground">AI Analysis</h2>
              </div>
              <Tabs defaultValue="beginner" className="w-full">
                <TabsList className="w-full rounded-none border-b border-border bg-transparent h-9">
                  <TabsTrigger value="beginner" className="text-xs flex-1 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Beginner</TabsTrigger>
                  <TabsTrigger value="expert" className="text-xs flex-1 rounded-none data-[state=active]:shadow-none data-[state=active]:border-b-2 data-[state=active]:border-primary">Expert</TabsTrigger>
                </TabsList>
                <TabsContent value="beginner" className="p-4">
                  <p className="text-sm text-foreground leading-relaxed">{analysis.beginnerExplanation}</p>
                </TabsContent>
                <TabsContent value="expert" className="p-4">
                  <p className="text-sm text-foreground leading-relaxed">{analysis.expertExplanation}</p>
                </TabsContent>
              </Tabs>
              <div className="px-4 pb-4 space-y-3">
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Reasons For</p>
                  <ul className="space-y-1">
                    {analysis.reasonsFor.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5 text-bullish shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Reasons Against</p>
                  <ul className="space-y-1">
                    {analysis.reasonsAgainst.map((r, i) => (
                      <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                        <XCircle className="h-3.5 w-3.5 text-bearish shrink-0 mt-0.5" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
                {analysis.noTradeReason && (
                  <div className="rounded-md bg-destructive/10 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1">No-Trade Reasoning</p>
                    <p className="text-xs text-foreground">{analysis.noTradeReason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Section 7 — Alert Controls */}
          <div className="rounded-lg border border-border bg-card p-4 space-y-3">
            <h2 className="text-sm font-semibold text-foreground flex items-center gap-1.5"><Bell className="h-4 w-4 text-primary" /> Alert Controls</h2>
            {[
              { key: "entry" as const, label: "Notify on entry zone reached" },
              { key: "confirmation" as const, label: "Notify on confirmation" },
              { key: "tpsl" as const, label: "Notify on TP / SL / invalidation" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between">
                <span className="text-xs text-foreground">{label}</span>
                <Switch checked={alerts[key]} onCheckedChange={() => toggleAlert(key)} />
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground">Alerts are visual only in this version.</p>
          </div>
        </div>
      </div>

      <p className="text-[10px] text-muted-foreground/60 text-center">⚠️ Prices are indicative only. Not financial advice.</p>
    </div>
  );
}
