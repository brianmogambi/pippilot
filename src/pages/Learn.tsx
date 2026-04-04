import { useState, useMemo } from "react";
import { Search, BookOpen, Zap, BarChart3, Shield, Bell, BookMarked, HelpCircle, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

/* ─── Section data ─── */

const sections = [
  { id: "getting-started", label: "Getting Started", icon: BookOpen },
  { id: "how-it-works", label: "How It Works", icon: Zap },
  { id: "signals", label: "Understanding Signals", icon: BarChart3 },
  { id: "risk", label: "Risk & Position Sizing", icon: Shield },
  { id: "alerts", label: "Alerts & Trade Mgmt", icon: Bell },
  { id: "glossary", label: "Glossary", icon: BookMarked },
  { id: "faq", label: "FAQ", icon: HelpCircle },
] as const;

/* ─── Getting Started ─── */

function GettingStarted() {
  const steps = [
    { n: 1, title: "Set up your account", desc: "Complete onboarding — set your experience level, preferred pairs, risk preferences, and account details." },
    { n: 2, title: "Add pairs to your watchlist", desc: "Browse available instruments and add the forex pairs you want to track. PipPilot monitors these for trading opportunities." },
    { n: 3, title: "Review signals", desc: "Check the Signals page for AI-generated trade ideas. Each signal includes entry, stop loss, take profit, and a confidence score." },
    { n: 4, title: "Use the risk calculator", desc: "Before entering any trade, use the calculator to determine the correct position size based on your account balance and risk tolerance." },
    { n: 5, title: "Monitor alerts", desc: "Stay informed with real-time alerts when setups form, entries are reached, or conditions change." },
    { n: 6, title: "Track performance", desc: "Log every trade in the journal. Review your results, emotions, and lessons learned to improve over time." },
  ];

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="text-base font-semibold text-foreground mb-2">What is PipPilot AI?</h3>
        <p className="text-sm text-muted-foreground leading-relaxed">
          PipPilot AI is an <strong>AI-assisted forex analysis platform</strong>. It helps traders identify potential trading opportunities by analyzing market structure, trends, and volatility across multiple timeframes.
        </p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-2">
          <strong>Important:</strong> PipPilot is <em>not</em> an auto-trading bot and does <em>not</em> guarantee profits. It provides structured trade ideas to support your decision-making — the final call is always yours.
        </p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground mb-1">Who is it for?</h3>
        <p className="text-sm text-muted-foreground">Beginner to intermediate forex traders who want a disciplined, risk-first approach to analyzing markets.</p>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">How to use PipPilot — step by step</h3>
        <div className="space-y-3">
          {steps.map((s) => (
            <div key={s.n} className="flex gap-3 items-start">
              <span className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{s.n}</span>
              <div>
                <p className="text-sm font-medium text-foreground">{s.title}</p>
                <p className="text-sm text-muted-foreground">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── How It Works ─── */

function HowItWorks() {
  return (
    <div className="space-y-6">
      <p className="text-sm text-muted-foreground leading-relaxed">
        PipPilot AI analyzes the forex market using a structured, rule-based process. Here's what happens behind the scenes:
      </p>

      <Accordion type="multiple" defaultValue={["analysis", "concepts"]} className="space-y-2">
        <AccordionItem value="analysis" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">The Analysis Process</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>1. <strong>Market structure scan</strong> — identifies trends, key levels, and price patterns across multiple timeframes.</p>
            <p>2. <strong>Setup detection</strong> — looks for high-probability setups such as breakouts, pullbacks, and reversals.</p>
            <p>3. <strong>Confluence scoring</strong> — checks how many factors align (trend, structure, indicators, timeframes). More confluence = higher confidence.</p>
            <p>4. <strong>Risk evaluation</strong> — applies risk rules before suggesting a trade. If the risk-reward ratio is poor, it may recommend "No Trade."</p>
            <p>5. <strong>Signal generation</strong> — outputs a structured trade idea with entry, stop loss, take profit levels, and a confidence score.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="concepts" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">Key Concepts</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-4">
            <div>
              <p className="font-medium text-foreground">Multi-Timeframe Analysis (MTF)</p>
              <p>PipPilot checks higher timeframes (e.g. daily, 4H) for trend direction, and lower timeframes (e.g. 1H, 15M) for entry precision. A trade aligned on multiple timeframes has stronger conviction.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Confluence</p>
              <p>When multiple factors agree — trend direction, key support/resistance, indicator confirmation — the setup has "confluence." More confluence means a higher-quality trade idea.</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Confirmation</p>
              <p>A signal may move from "monitoring" to "ready" when price action confirms the expected move (e.g. a candlestick pattern at a key level).</p>
            </div>
            <div>
              <p className="font-medium text-foreground">Invalidation</p>
              <p>Every signal has conditions that would make it invalid. If price breaks through a key level in the wrong direction, the setup is cancelled — protecting you from a bad trade.</p>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="no-trade" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">When PipPilot says "No Trade"</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">
            <p>Not every market condition is suitable for trading. PipPilot may output a "No Trade" verdict when:</p>
            <ul className="list-disc list-inside mt-2 space-y-1">
              <li>There is no clear trend or structure</li>
              <li>Volatility is too high or too low</li>
              <li>The risk-reward ratio is unfavorable</li>
              <li>Major news events create uncertainty</li>
            </ul>
            <p className="mt-2 font-medium text-foreground">Staying out of the market is sometimes the best trade.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* ─── Understanding Signals ─── */

function UnderstandingSignals() {
  const fields = [
    { name: "Pair", desc: "The forex instrument (e.g. EUR/USD, GBP/JPY)." },
    { name: "Direction", desc: "Buy (long) or Sell (short) — the expected move." },
    { name: "Entry Price", desc: "The recommended price to enter the trade." },
    { name: "Stop Loss (SL)", desc: "The price at which you exit to limit losses. Always set this." },
    { name: "Take Profit 1 (TP1)", desc: "The first profit target — conservative." },
    { name: "Take Profit 2 (TP2)", desc: "A second, extended target for partial profits." },
    { name: "Take Profit 3 (TP3)", desc: "The most optimistic target — only in strong setups." },
    { name: "Confidence Score", desc: "0–100 rating of how many factors align. Higher = stronger setup, but never a guarantee." },
    { name: "Setup Type", desc: "The pattern or strategy identified (breakout, pullback, reversal, etc.)." },
    { name: "Risk-Reward Ratio", desc: "How much you stand to gain vs. how much you risk. Aim for 1:2 or better." },
  ];

  const statuses = [
    { status: "Monitoring", color: "secondary" as const, desc: "Setup is forming — not ready yet." },
    { status: "Ready", color: "default" as const, desc: "Conditions met — trade idea is actionable." },
    { status: "Triggered", color: "default" as const, desc: "Entry price has been reached." },
    { status: "Invalidated", color: "destructive" as const, desc: "Conditions changed — do NOT enter." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Signal Fields Explained</h3>
        <div className="grid gap-2">
          {fields.map((f) => (
            <div key={f.name} className="flex gap-3 items-baseline rounded-lg border border-border p-3">
              <span className="text-sm font-medium text-foreground min-w-[140px]">{f.name}</span>
              <span className="text-sm text-muted-foreground">{f.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Signal Statuses</h3>
        <div className="grid gap-2">
          {statuses.map((s) => (
            <div key={s.status} className="flex items-center gap-3 rounded-lg border border-border p-3">
              <Badge variant={s.color} className="min-w-[100px] justify-center">{s.status}</Badge>
              <span className="text-sm text-muted-foreground">{s.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-amber-500/30 bg-amber-500/5">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">⚠️ When NOT to take a signal</p>
          <ul className="list-disc list-inside space-y-1">
            <li>If the signal status is "Monitoring" or "Invalidated"</li>
            <li>If you don't understand the setup type</li>
            <li>If you're already over-exposed on correlated pairs</li>
            <li>If major news is imminent and you haven't planned for it</li>
            <li>If the risk-reward ratio is below 1:1.5</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Risk & Position Sizing ─── */

function RiskSection() {
  return (
    <div className="space-y-6">
      <Accordion type="multiple" defaultValue={["basics", "calc"]} className="space-y-2">
        <AccordionItem value="basics" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">Risk Per Trade — The Basics</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p><strong>Risk per trade</strong> is the percentage of your account you're willing to lose on a single trade. Most professionals risk <strong>1–2%</strong> per trade.</p>
            <div className="rounded-lg bg-muted/30 p-3 space-y-1">
              <p className="font-medium text-foreground">Example:</p>
              <p>Account balance: $10,000</p>
              <p>Risk per trade: 1% = <strong>$100 maximum loss</strong></p>
              <p>If your stop loss is 50 pips, your position size adjusts so that 50 pips = $100.</p>
            </div>
            <p><strong>Why 1–2%?</strong> Even with 10 losing trades in a row (which happens), you'd only lose 10–20% of your account — recoverable. At 10% risk per trade, 10 losses wipes you out.</p>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="calc" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">Risk Calculator Outputs</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>The PipPilot risk calculator gives you:</p>
            <div className="space-y-2">
              <div className="flex gap-2"><ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><div><strong>Lot Size</strong> — the exact position size for your risk parameters.</div></div>
              <div className="flex gap-2"><ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><div><strong>Money at Risk</strong> — the dollar amount you'd lose if stopped out.</div></div>
              <div className="flex gap-2"><ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><div><strong>Risk-Reward Ratio</strong> — potential gain divided by potential loss.</div></div>
              <div className="flex gap-2"><ChevronRight className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" /><div><strong>Warnings</strong> — alerts if your risk exceeds safe thresholds.</div></div>
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="streaks" className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">Losing Streaks & Drawdown</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground space-y-3">
            <p>Losing streaks are <strong>normal</strong> in trading. Even a strategy with 60% win rate will have runs of 5–8 consecutive losses.</p>
            <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3">
              <p className="font-medium text-foreground mb-1">⚠️ Why overleveraging is dangerous</p>
              <p>Risking 10% per trade: 5 losses = 50% account gone. You now need a 100% return just to break even.</p>
              <p className="mt-1">Risking 1% per trade: 5 losses = 5% account gone. Easily recoverable.</p>
            </div>
            <p>PipPilot includes daily drawdown protection — if you lose more than your maximum daily limit, the system warns you to stop trading for the day.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}

/* ─── Alerts ─── */

function AlertsSection() {
  const alertTypes = [
    { type: "Setup Forming", desc: "A potential trade setup is developing — be ready." },
    { type: "Entry Reached", desc: "Price has hit the recommended entry level." },
    { type: "Confirmation", desc: "Price action confirms the expected move." },
    { type: "Move SL to Breakeven", desc: "Trade is in profit — move stop loss to entry to eliminate risk." },
    { type: "Take Profit", desc: "Price has reached a take-profit target — consider closing or scaling out." },
    { type: "Exit Signal", desc: "Conditions have changed — consider closing the trade." },
    { type: "Invalidation", desc: "The setup is no longer valid — do not enter or exit immediately." },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-base font-semibold text-foreground mb-3">Alert Types</h3>
        <div className="grid gap-2">
          {alertTypes.map((a) => (
            <div key={a.type} className="flex gap-3 items-baseline rounded-lg border border-border p-3">
              <span className="text-sm font-medium text-foreground min-w-[180px]">{a.type}</span>
              <span className="text-sm text-muted-foreground">{a.desc}</span>
            </div>
          ))}
        </div>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="p-4 text-sm text-muted-foreground space-y-2">
          <p className="font-semibold text-foreground">💡 Trading Discipline Tips</p>
          <ul className="list-disc list-inside space-y-1">
            <li><strong>Don't chase trades</strong> — if you missed the entry, wait for the next one.</li>
            <li><strong>Follow your plan</strong> — set entry, SL, and TP before you trade, then stick to it.</li>
            <li><strong>Accept losses</strong> — they're part of trading. A good loss (with proper risk) is better than a bad win.</li>
            <li><strong>Review, don't react</strong> — use alerts as information, not impulse triggers.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Glossary ─── */

const glossaryTerms = [
  { term: "Pip", def: "The smallest standard price movement in forex (0.0001 for most pairs, 0.01 for JPY pairs)." },
  { term: "Lot Size", def: "The volume of a trade. Standard lot = 100,000 units. Mini = 10,000. Micro = 1,000." },
  { term: "Spread", def: "The difference between the buy (ask) and sell (bid) price. This is the broker's fee." },
  { term: "Leverage", def: "Borrowed capital that amplifies your position size. 1:100 means $1,000 controls $100,000. Higher leverage = higher risk." },
  { term: "Margin", def: "The collateral required to open a leveraged position. If margin runs out, your broker closes your trades." },
  { term: "Stop Loss (SL)", def: "A preset order that closes your trade at a specific loss level to protect your account." },
  { term: "Take Profit (TP)", def: "A preset order that closes your trade at a specific profit level to lock in gains." },
  { term: "Support", def: "A price level where buying pressure tends to prevent further decline." },
  { term: "Resistance", def: "A price level where selling pressure tends to prevent further rise." },
  { term: "Trend", def: "The overall direction of price movement — uptrend (higher highs), downtrend (lower lows), or sideways." },
  { term: "Breakout", def: "When price moves decisively beyond a support or resistance level, often signaling a new trend." },
  { term: "Pullback", def: "A temporary move against the main trend — often a good entry opportunity." },
  { term: "Volatility", def: "How much price moves in a given period. High volatility = bigger swings, more risk." },
  { term: "Liquidity", def: "How easily a pair can be traded without affecting price. Major pairs (EUR/USD) have high liquidity." },
  { term: "Risk-Reward Ratio", def: "Potential profit divided by potential loss. A 1:3 ratio means you risk $1 to potentially make $3." },
  { term: "Drawdown", def: "The decline from a peak account balance to a trough. Measures how much you've lost before recovering." },
  { term: "Confluence", def: "When multiple analysis factors align in the same direction, increasing the probability of a setup." },
];

function GlossarySection({ search }: { search: string }) {
  const filtered = useMemo(
    () => glossaryTerms.filter((g) => {
      const q = search.toLowerCase();
      return g.term.toLowerCase().includes(q) || g.def.toLowerCase().includes(q);
    }),
    [search],
  );

  return (
    <div className="space-y-2">
      {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4">No glossary terms match your search.</p>}
      {filtered.map((g) => (
        <div key={g.term} className="rounded-lg border border-border p-3">
          <p className="text-sm font-semibold text-foreground">{g.term}</p>
          <p className="text-sm text-muted-foreground mt-0.5">{g.def}</p>
        </div>
      ))}
    </div>
  );
}

/* ─── FAQ ─── */

const faqItems = [
  { q: "Is PipPilot a trading bot?", a: "No. PipPilot AI provides trade analysis and ideas — it does not place trades on your behalf. You always make the final decision." },
  { q: "Does PipPilot guarantee profits?", a: "No. No tool, system, or strategy can guarantee profits in forex trading. PipPilot helps you make more informed decisions, but losses are a normal part of trading." },
  { q: "Why do some signals fail?", a: "Markets are inherently unpredictable. Even high-confidence setups can fail due to unexpected news, liquidity events, or shifts in market sentiment. That's why proper risk management is essential." },
  { q: "What does the confidence score mean?", a: "The confidence score (0–100) reflects how many analysis factors align for a given setup. A higher score means more confluence — but it's not a prediction of success. Even a 90% confidence signal can result in a loss." },
  { q: "Why does it sometimes say 'No Trade'?", a: "This means conditions aren't favorable. There's no clear setup, the risk-reward is poor, or volatility is too high/low. Staying out of the market is often the best decision." },
  { q: "How much should I risk per trade?", a: "Most professionals recommend risking 1–2% of your account per trade. This ensures that losing streaks don't destroy your account. Use the built-in risk calculator to determine position size." },
  { q: "Can I use this with any broker?", a: "PipPilot provides analysis independently of any broker. You can use its signals with any forex broker that supports the pairs PipPilot covers. The app does not connect to or interact with broker accounts." },
  { q: "Is my data private?", a: "Yes. Your account data, journal entries, and settings are stored securely and are only accessible to you." },
];

function FAQSection({ search }: { search: string }) {
  const filtered = useMemo(
    () => faqItems.filter((f) => {
      const q = search.toLowerCase();
      return f.q.toLowerCase().includes(q) || f.a.toLowerCase().includes(q);
    }),
    [search],
  );

  return (
    <Accordion type="multiple" className="space-y-2">
      {filtered.length === 0 && <p className="text-sm text-muted-foreground py-4">No FAQ items match your search.</p>}
      {filtered.map((f, i) => (
        <AccordionItem key={i} value={`faq-${i}`} className="border border-border rounded-lg px-4">
          <AccordionTrigger className="text-sm font-semibold">{f.q}</AccordionTrigger>
          <AccordionContent className="text-sm text-muted-foreground">{f.a}</AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

/* ─── Main Page ─── */

export default function Learn() {
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("getting-started");

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Learn</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your in-app knowledge hub — understand how PipPilot AI works and become a better trader.
        </p>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search help topics, glossary, FAQ…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Tabs — scrollable on mobile */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <div className="overflow-x-auto -mx-4 px-4 md:mx-0 md:px-0">
          <TabsList className="inline-flex w-auto min-w-max">
            {sections.map((s) => (
              <TabsTrigger key={s.id} value={s.id} className="gap-1.5 text-xs md:text-sm">
                <s.icon className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.label.split(" ")[0]}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="getting-started"><GettingStarted /></TabsContent>
        <TabsContent value="how-it-works"><HowItWorks /></TabsContent>
        <TabsContent value="signals"><UnderstandingSignals /></TabsContent>
        <TabsContent value="risk"><RiskSection /></TabsContent>
        <TabsContent value="alerts"><AlertsSection /></TabsContent>
        <TabsContent value="glossary"><GlossarySection search={search} /></TabsContent>
        <TabsContent value="faq"><FAQSection search={search} /></TabsContent>
      </Tabs>

      {/* Disclaimer */}
      <div className="rounded-lg border border-border bg-muted/20 p-4 mt-8">
        <p className="text-xs text-muted-foreground leading-relaxed">
          ⚠️ <strong>Disclaimer:</strong> PipPilot AI provides educational content and AI-assisted analysis only. Nothing on this platform constitutes financial advice. Trading forex involves significant risk — you can lose more than your initial investment. Always do your own research and consult a qualified financial advisor before making trading decisions.
        </p>
      </div>
    </div>
  );
}
