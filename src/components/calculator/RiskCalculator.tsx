import { useState, useMemo, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Calculator, ShieldAlert, AlertTriangle, Shield } from "lucide-react";
import { INSTRUMENT_PAIRS, isJpyPair, pipMultiplier } from "@/lib/pip-value";
import { usePipValue } from "@/hooks/use-pip-value";
import {
  calculatePipDistance,
  evaluateTrade,
  type AccountState,
  type RiskProfile,
  type TradeInputs,
  type DailyState,
  type RiskWarning,
} from "@/lib/risk-engine";

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"] as const;
const PAIRS = [...INSTRUMENT_PAIRS];

interface Props {
  defaultEntry?: number;
  defaultSl?: number;
}

export default function RiskCalculator({ defaultEntry, defaultSl }: Props) {
  const [balance, setBalance] = useState(10_000);
  const [equity, setEquity] = useState(10_000);
  const [currency, setCurrency] = useState<string>("USD");
  const [pair, setPair] = useState<string>("EUR/USD");
  const [entry, setEntry] = useState(defaultEntry ?? 0);
  const [sl, setSl] = useState(defaultSl ?? 0);
  const [slPips, setSlPips] = useState(0);
  const [riskPct, setRiskPct] = useState(1);
  const [fixedRisk, setFixedRisk] = useState<number | "">("");
  const [openRisk, setOpenRisk] = useState<number | "">("");
  const [conservative, setConservative] = useState(false);

  // Bidirectional SL ↔ pips sync — uses engine helper for parity
  const handleSlChange = useCallback(
    (val: number) => {
      setSl(val);
      if (entry && val) setSlPips(+(calculatePipDistance(pair, entry, val).toFixed(1)));
    },
    [entry, pair],
  );

  const handleSlPipsChange = useCallback(
    (pips: number) => {
      setSlPips(pips);
      if (entry && pips > 0) {
        const direction = sl < entry ? -1 : 1;
        const newSl = entry + (direction * pips) / pipMultiplier(pair);
        setSl(+newSl.toFixed(isJpyPair(pair) ? 3 : 5));
      }
    },
    [entry, sl, pair],
  );

  const handleEntryChange = useCallback(
    (val: number) => {
      setEntry(val);
      if (sl && val) setSlPips(+(calculatePipDistance(pair, val, sl).toFixed(1)));
    },
    [sl, pair],
  );

  const { pipValue: pipVal, freshness: pipFreshness } = usePipValue(pair);

  // Single source of truth: the risk engine
  const evaluation = useMemo(() => {
    const account: AccountState = { balance, equity, currency };
    const profile: RiskProfile = {
      riskPerTradePct: riskPct,
      maxDailyLossPct: 100, // calculator has no profile cap; the safety thresholds still apply
      maxTotalOpenRiskPct: 100,
      conservativeMode: conservative,
    };
    const trade: TradeInputs = {
      pair,
      entry,
      stopLoss: sl,
      pipValueUSD: pipVal,
      riskMode: fixedRisk !== "" && Number(fixedRisk) > 0 ? "fixed" : "percent",
      fixedRiskAmount: fixedRisk === "" ? undefined : Number(fixedRisk),
    };
    const daily: DailyState = {
      realizedLossUSD: 0,
      openRiskUSD: typeof openRisk === "number" ? openRisk : 0,
    };
    return evaluateTrade({ account, profile, trade, daily });
  }, [balance, equity, currency, pair, entry, sl, riskPct, fixedRisk, openRisk, conservative, pipVal]);

  const errors = evaluation.validationErrors;
  const canCalc = Object.keys(errors).length === 0 && evaluation.pipDistance > 0;

  // Warnings the calculator should not double-show inline:
  // validation_error rows are surfaced inline next to each input via `errors`.
  const bannerWarnings = evaluation.warnings.filter((w) => w.code !== "validation_error");

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          <h3 className="font-semibold text-foreground">Position Size Calculator</h3>
        </div>
        <div className="flex items-center gap-2">
          <Label htmlFor="conservative" className="text-xs text-muted-foreground cursor-pointer">
            Conservative
          </Label>
          <Switch
            id="conservative"
            checked={conservative}
            onCheckedChange={setConservative}
          />
          {conservative && (
            <span className="inline-flex items-center rounded-full border border-warning/30 bg-warning/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-warning">
              <Shield className="h-3 w-3 mr-1" /> Conservative
            </span>
          )}
        </div>
      </div>

      {/* Inputs */}
      <div className="rounded-lg border border-border bg-card p-5 space-y-4">
        {/* Row 1: Balance + Equity */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Account Balance (${currency})`} error={errors.balance}>
            <Input
              type="number" value={balance}
              onChange={(e) => setBalance(Number(e.target.value))}
              className="bg-muted border-border"
            />
          </Field>
          <Field label={`Account Equity (${currency})`}>
            <Input
              type="number" value={equity}
              onChange={(e) => setEquity(Number(e.target.value))}
              className="bg-muted border-border"
            />
          </Field>
        </div>

        {/* Row 2: Currency + Pair */}
        <div className="grid grid-cols-2 gap-4">
          <Field label="Account Currency">
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Selected Pair">
            <Select value={pair} onValueChange={setPair}>
              <SelectTrigger className="bg-muted border-border">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAIRS.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>

        {/* Row 3: Entry + SL */}
        <div className="grid grid-cols-3 gap-4">
          <Field label="Entry Price" error={errors.entry}>
            <Input
              type="number" value={entry || ""}
              onChange={(e) => handleEntryChange(Number(e.target.value))}
              step={isJpyPair(pair) ? 0.01 : 0.0001}
              className="bg-muted border-border"
            />
          </Field>
          <Field label="Stop Loss" error={errors.stopLoss}>
            <Input
              type="number" value={sl || ""}
              onChange={(e) => handleSlChange(Number(e.target.value))}
              step={isJpyPair(pair) ? 0.01 : 0.0001}
              className="bg-muted border-border"
            />
          </Field>
          <Field label="SL (pips)">
            <Input
              type="number" value={slPips || ""}
              onChange={(e) => handleSlPipsChange(Number(e.target.value))}
              step={0.1} min={0}
              className="bg-muted border-border"
            />
          </Field>
        </div>

        {/* Row 4: Risk slider + input */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs text-muted-foreground">Risk % per Trade</Label>
            <span className="text-xs font-mono text-foreground">{riskPct.toFixed(1)}%</span>
          </div>
          <Slider
            value={[riskPct]} onValueChange={([v]) => setRiskPct(v)}
            min={0.1} max={10} step={0.1}
          />
          {errors.riskPct && <p className="text-xs text-destructive">{errors.riskPct}</p>}
        </div>

        {/* Row 5: Optional inputs */}
        <div className="grid grid-cols-2 gap-4">
          <Field label={`Fixed Risk Amount (${currency}) — optional`}>
            <Input
              type="number" value={fixedRisk}
              onChange={(e) => setFixedRisk(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Overrides %"
              className="bg-muted border-border"
            />
          </Field>
          <Field label={`Current Open Risk (${currency}) — optional`}>
            <Input
              type="number" value={openRisk}
              onChange={(e) => setOpenRisk(e.target.value === "" ? "" : Number(e.target.value))}
              placeholder="Existing exposure"
              className="bg-muted border-border"
            />
          </Field>
        </div>
      </div>

      {/* Results */}
      <div className="rounded-lg border border-primary/30 bg-primary/5 p-5 space-y-4">
        <h4 className="text-sm font-semibold text-foreground">Results</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <ResultCell label="Max Risk" value={`$${evaluation.riskAmountUSD.toFixed(2)}`} />
          <ResultCell
            label="Lot Size"
            value={canCalc ? evaluation.lotSize.toFixed(2) : "—"}
            sub={canCalc ? `${(evaluation.lotSize * 10).toFixed(1)} mini · ${(evaluation.lotSize * 100).toFixed(0)} micro` : undefined}
            highlight
          />
          <ResultCell label="Pip Value" value={`$${pipVal.toFixed(2)}/pip`} sub={pipFreshness === "live" ? "live" : "estimated"} />
          <ResultCell
            label="Exposure"
            value={canCalc ? `${currency} ${evaluation.exposureUnits.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          />
        </div>
      </div>

      {/* Warnings — driven by engine output */}
      {bannerWarnings.map((w, i) => (
        <Warning key={`${w.code}-${i}`} warning={w} />
      ))}
    </div>
  );
}

// ── Sub-components ──

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function ResultCell({ label, value, sub, highlight }: { label: string; value: string; sub?: string; highlight?: boolean }) {
  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${highlight ? "text-primary" : "text-foreground"}`}>{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground">{sub}</p>}
    </div>
  );
}

function Warning({ warning }: { warning: RiskWarning }) {
  const variant: "destructive" | "warning" | "info" =
    warning.level === "block" ? "destructive" : warning.level === "warn" ? "warning" : "info";
  const styles = {
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-warning/30 bg-warning/10 text-warning",
    info: "border-primary/30 bg-primary/10 text-primary",
  };
  const Icon =
    variant === "destructive" ? ShieldAlert : variant === "warning" ? AlertTriangle : Shield;
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${styles[variant]}`}>
      <Icon className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{warning.message}</span>
    </div>
  );
}
