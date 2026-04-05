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

// ── Pure calculation helpers ──

const CURRENCIES = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF"] as const;

const PAIRS = [...INSTRUMENT_PAIRS];

function calculateRiskAmount(balance: number, riskPct: number, fixedAmount?: number) {
  if (fixedAmount && fixedAmount > 0) return fixedAmount;
  return balance * (riskPct / 100);
}

function calculatePipDistance(entry: number, sl: number, pair: string) {
  return Math.abs(entry - sl) * pipMultiplier(pair);
}

function calculateLotSize(riskAmount: number, pipDistance: number, pipVal: number) {
  if (pipDistance <= 0 || pipVal <= 0) return 0;
  return riskAmount / (pipDistance * pipVal);
}

function calculateExposure(lotSize: number) {
  return lotSize * 100_000;
}

// ── Validation ──

interface ValidationErrors {
  balance?: string;
  entry?: string;
  sl?: string;
  riskPct?: string;
}

function validate(balance: number, entry: number, sl: number, riskPct: number): ValidationErrors {
  const errors: ValidationErrors = {};
  if (balance <= 0) errors.balance = "Must be positive";
  if (!entry || entry <= 0) errors.entry = "Required";
  if (!sl || sl <= 0) errors.sl = "Required";
  if (entry && sl && entry === sl) errors.sl = "Must differ from entry";
  if (riskPct < 0.1 || riskPct > 10) errors.riskPct = "0.1% – 10%";
  return errors;
}

// ── Component ──

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

  // Bidirectional SL ↔ pips sync
  const handleSlChange = useCallback(
    (val: number) => {
      setSl(val);
      if (entry && val) setSlPips(+(calculatePipDistance(entry, val, pair).toFixed(1)));
    },
    [entry, pair],
  );

  const handleSlPipsChange = useCallback(
    (pips: number) => {
      setSlPips(pips);
      if (entry && pips > 0) {
        // Assume SL below entry for long, just pick direction based on existing SL
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
      if (sl && val) setSlPips(+(calculatePipDistance(val, sl, pair).toFixed(1)));
    },
    [sl, pair],
  );

  const errors = useMemo(() => validate(balance, entry, sl, riskPct), [balance, entry, sl, riskPct]);
  const hasErrors = Object.keys(errors).length > 0;

  const { pipValue: pipVal, isLive: isPipValueLive } = usePipValue(pair);
  const riskAmount = calculateRiskAmount(balance, riskPct, fixedRisk === "" ? undefined : fixedRisk);
  const pipDistance = entry && sl ? calculatePipDistance(entry, sl, pair) : 0;
  let lotSize = calculateLotSize(riskAmount, pipDistance, pipVal);
  if (conservative) lotSize = lotSize / 2;
  const exposure = calculateExposure(lotSize);

  const currentOpenRiskVal = typeof openRisk === "number" ? openRisk : 0;
  const totalRisk = currentOpenRiskVal + riskAmount;
  const totalRiskPct = balance > 0 ? (totalRisk / balance) * 100 : 0;
  const exceedsThreshold = totalRiskPct > 5;
  const nearDailyLimit = totalRiskPct > 3;

  const canCalc = !hasErrors && entry > 0 && sl > 0 && pipDistance > 0;

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
          <Field label="Stop Loss" error={errors.sl}>
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
          <ResultCell label="Max Risk" value={`$${riskAmount.toFixed(2)}`} />
          <ResultCell
            label="Lot Size"
            value={canCalc ? lotSize.toFixed(2) : "—"}
            sub={canCalc ? `${(lotSize * 10).toFixed(1)} mini · ${(lotSize * 100).toFixed(0)} micro` : undefined}
            highlight
          />
          <ResultCell label="Pip Value" value={`$${pipVal.toFixed(2)}/pip`} sub={isPipValueLive ? "live" : "est."} />
          <ResultCell
            label="Exposure"
            value={canCalc ? `${currency} ${exposure.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : "—"}
          />
        </div>
      </div>

      {/* Warnings */}
      {exceedsThreshold && (
        <Warning icon={<ShieldAlert className="h-4 w-4" />} variant="destructive">
          Total open risk would be <strong>{totalRiskPct.toFixed(1)}%</strong> of balance — exceeds the 5% safety threshold.
        </Warning>
      )}
      {!exceedsThreshold && nearDailyLimit && (
        <Warning icon={<AlertTriangle className="h-4 w-4" />} variant="warning">
          Total open risk is <strong>{totalRiskPct.toFixed(1)}%</strong> of balance — approaching the 3% daily loss guideline.
        </Warning>
      )}
      {conservative && (
        <Warning icon={<Shield className="h-4 w-4" />} variant="info">
          Conservative mode is ON — lot size is halved. Recommended for beginners to reduce emotional pressure and protect capital during the learning curve.
        </Warning>
      )}
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

function Warning({ icon, variant, children }: { icon: React.ReactNode; variant: "destructive" | "warning" | "info"; children: React.ReactNode }) {
  const styles = {
    destructive: "border-destructive/30 bg-destructive/10 text-destructive",
    warning: "border-warning/30 bg-warning/10 text-warning",
    info: "border-primary/30 bg-primary/10 text-primary",
  };
  return (
    <div className={`flex items-start gap-2 rounded-lg border p-3 text-xs leading-relaxed ${styles[variant]}`}>
      <span className="mt-0.5 shrink-0">{icon}</span>
      <span>{children}</span>
    </div>
  );
}
