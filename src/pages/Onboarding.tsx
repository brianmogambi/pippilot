import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ArrowRight, Check, Zap } from "lucide-react";

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", desc: "New to forex trading — learning the basics of charts, pairs, and risk." },
  { value: "intermediate", label: "Intermediate", desc: "Comfortable with technical analysis, placing trades, and managing positions." },
  { value: "advanced", label: "Advanced", desc: "Experienced trader with a proven strategy and disciplined risk management." },
];

const STYLE_OPTIONS = [
  { value: "scalping", label: "Scalping", desc: "Very short trades (seconds to minutes). High frequency, small gains." },
  { value: "intraday", label: "Intraday", desc: "Trades opened and closed within the same day. No overnight exposure." },
  { value: "swing", label: "Swing", desc: "Trades held for days or weeks, capturing larger price moves." },
];

const MAJOR_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD"];
const MINOR_PAIRS = ["EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD", "GBP/AUD"];
const ALL_PAIRS = [...MAJOR_PAIRS, ...MINOR_PAIRS];

const SESSIONS = [
  { value: "london", label: "London", desc: "08:00–16:00 GMT — Highest liquidity" },
  { value: "new_york", label: "New York", desc: "13:00–21:00 GMT — Overlaps with London" },
  { value: "asia", label: "Asia / Tokyo", desc: "00:00–08:00 GMT — Lower volatility" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF", "NZD"];

export default function Onboarding() {
  const { user, refetchProfile } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [tradingStyle, setTradingStyle] = useState("intraday");

  const [currency, setCurrency] = useState("USD");
  const [brokerName, setBrokerName] = useState("");
  const [accountBalance, setAccountBalance] = useState(10000);
  const [accountEquity, setAccountEquity] = useState(10000);
  const [preferredPairs, setPreferredPairs] = useState<string[]>([]);
  const [preferredSessions, setPreferredSessions] = useState<string[]>([]);

  const [defaultRisk, setDefaultRisk] = useState(1);
  const [maxDailyLoss, setMaxDailyLoss] = useState(5);

  const togglePair = (pair: string) =>
    setPreferredPairs((p) => (p.includes(pair) ? p.filter((x) => x !== pair) : [...p, pair]));
  const toggleSession = (s: string) =>
    setPreferredSessions((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const handleSubmit = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName || user.email,
        experience_level: experience,
        trading_style: tradingStyle,
        account_currency: currency,
        broker_name: brokerName || null,
        account_size: accountBalance,
        account_equity: accountEquity,
        preferred_pairs: preferredPairs,
        preferred_sessions: preferredSessions,
        default_risk_pct: defaultRisk,
        max_daily_loss_pct: maxDailyLoss,
        onboarding_completed: true,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error saving profile", description: error.message, variant: "destructive" });
    } else {
      await refetchProfile();
      navigate("/", { replace: true });
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-lg space-y-6">
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Zap className="h-6 w-6 text-primary" />
            <h1 className="text-2xl font-bold text-foreground">Welcome to PipPilot AI</h1>
          </div>
          <p className="text-sm text-muted-foreground">Let's set up your trading profile — takes about 60 seconds.</p>
        </div>

        <Progress value={(step / 3) * 100} className="h-1.5" />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span className={step >= 1 ? "text-primary font-medium" : ""}>About You</span>
          <span className={step >= 2 ? "text-primary font-medium" : ""}>Account Setup</span>
          <span className={step >= 3 ? "text-primary font-medium" : ""}>Risk Preferences</span>
        </div>

        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          {step === 1 && (
            <>
              <h2 className="font-semibold text-foreground text-lg">About You</h2>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Display Name</Label>
                <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="e.g. Trader Joe" className="bg-muted border-border" />
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Experience Level</Label>
                {EXPERIENCE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setExperience(o.value)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${experience === o.value ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:border-muted-foreground/30"}`}
                  >
                    <span className="font-medium text-sm text-foreground">{o.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Trading Style</Label>
                {STYLE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    onClick={() => setTradingStyle(o.value)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${tradingStyle === o.value ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:border-muted-foreground/30"}`}
                  >
                    <span className="font-medium text-sm text-foreground">{o.label}</span>
                    <p className="text-xs text-muted-foreground mt-0.5">{o.desc}</p>
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <h2 className="font-semibold text-foreground text-lg">Account Setup</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Currency</Label>
                  <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                    {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Broker Name <span className="opacity-50">(optional)</span></Label>
                  <Input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="e.g. IC Markets" className="bg-muted border-border" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Balance ({currency})</Label>
                  <Input type="number" value={accountBalance} onChange={(e) => setAccountBalance(Number(e.target.value))} className="bg-muted border-border" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Account Equity ({currency})</Label>
                  <Input type="number" value={accountEquity} onChange={(e) => setAccountEquity(Number(e.target.value))} className="bg-muted border-border" />
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preferred Pairs</Label>
                <p className="text-xs text-muted-foreground">Select the currency pairs you trade most. We'll prioritize signals for these.</p>
                <div className="flex flex-wrap gap-2">
                  {ALL_PAIRS.map((pair) => (
                    <button
                      key={pair}
                      onClick={() => togglePair(pair)}
                      className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${preferredPairs.includes(pair) ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30"}`}
                    >
                      {pair}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Preferred Trading Sessions</Label>
                {SESSIONS.map((s) => (
                  <label key={s.value} className="flex items-start gap-3 rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
                    <Checkbox checked={preferredSessions.includes(s.value)} onCheckedChange={() => toggleSession(s.value)} className="mt-0.5" />
                    <div>
                      <span className="text-sm font-medium text-foreground">{s.label}</span>
                      <p className="text-xs text-muted-foreground">{s.desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </>
          )}

          {step === 3 && (
            <>
              <h2 className="font-semibold text-foreground text-lg">Risk Preferences</h2>
              <p className="text-xs text-muted-foreground">These settings help PipPilot AI calculate position sizes and manage your risk. You can always change them later in Settings.</p>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Default Risk Per Trade (%)</Label>
                <Input type="number" value={defaultRisk} onChange={(e) => setDefaultRisk(Number(e.target.value))} step={0.5} min={0.1} max={10} className="bg-muted border-border" />
                <p className="text-xs text-muted-foreground">The percentage of your account you're willing to risk on each trade. Most professional traders risk 1–2%.</p>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Max Daily Loss (%)</Label>
                <Input type="number" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(Number(e.target.value))} step={0.5} min={1} max={20} className="bg-muted border-border" />
                <p className="text-xs text-muted-foreground">Stop trading for the day when your losses reach this threshold. A common setting is 3–5% of your account.</p>
              </div>

              <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                <p className="text-xs text-warning">⚠️ Trading carries risk. PipPilot AI provides AI-assisted analysis, not financial advice. Always trade responsibly.</p>
              </div>
            </>
          )}
        </div>

        <div className="flex gap-3">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(step - 1)} className="flex-1">
              <ArrowLeft className="h-4 w-4 mr-1" /> Back
            </Button>
          )}
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} className="flex-1">
              Next <ArrowRight className="h-4 w-4 ml-1" />
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={saving} className="flex-1">
              {saving ? "Saving..." : <>Complete Setup <Check className="h-4 w-4 ml-1" /></>}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
