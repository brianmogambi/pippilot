import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Save } from "lucide-react";

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner" },
  { value: "intermediate", label: "Intermediate" },
  { value: "advanced", label: "Advanced" },
];

const STYLE_OPTIONS = [
  { value: "scalping", label: "Scalping" },
  { value: "intraday", label: "Intraday" },
  { value: "swing", label: "Swing" },
];

const MAJOR_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD"];
const MINOR_PAIRS = ["EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD", "GBP/AUD"];
const ALL_PAIRS = [...MAJOR_PAIRS, ...MINOR_PAIRS];

const SESSIONS = [
  { value: "london", label: "London" },
  { value: "new_york", label: "New York" },
  { value: "asia", label: "Asia / Tokyo" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF", "NZD"];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney",
];

export default function SettingsPage() {
  const { profile, user, refetchProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [tradingStyle, setTradingStyle] = useState("intraday");
  const [currency, setCurrency] = useState("USD");
  const [brokerName, setBrokerName] = useState("");
  const [accountBalance, setAccountBalance] = useState(10000);
  const [accountEquity, setAccountEquity] = useState(10000);
  const [defaultRisk, setDefaultRisk] = useState(1);
  const [maxDailyLoss, setMaxDailyLoss] = useState(5);
  const [preferredPairs, setPreferredPairs] = useState<string[]>([]);
  const [preferredSessions, setPreferredSessions] = useState<string[]>([]);
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setExperience(profile.experience_level || "beginner");
      setTradingStyle(profile.trading_style || "intraday");
      setCurrency(profile.account_currency || "USD");
      setBrokerName(profile.broker_name || "");
      setAccountBalance(profile.account_size || 10000);
      setAccountEquity(profile.account_equity || 10000);
      setDefaultRisk(profile.default_risk_pct || 1);
      setMaxDailyLoss(profile.max_daily_loss_pct || 5);
      setPreferredPairs(profile.preferred_pairs || []);
      setPreferredSessions(profile.preferred_sessions || []);
      setNotificationsEnabled(profile.notifications_enabled ?? true);
      setTimezone(profile.timezone || "UTC");
    }
  }, [profile]);

  const togglePair = (pair: string) =>
    setPreferredPairs((p) => (p.includes(pair) ? p.filter((x) => x !== pair) : [...p, pair]));
  const toggleSession = (s: string) =>
    setPreferredSessions((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        experience_level: experience,
        trading_style: tradingStyle,
        account_currency: currency,
        broker_name: brokerName || null,
        account_size: accountBalance,
        account_equity: accountEquity,
        default_risk_pct: defaultRisk,
        max_daily_loss_pct: maxDailyLoss,
        preferred_pairs: preferredPairs,
        preferred_sessions: preferredSessions,
        notifications_enabled: notificationsEnabled,
        timezone: timezone,
      })
      .eq("user_id", user.id);

    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await refetchProfile();
      toast({ title: "Settings saved" });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, risk preferences, and app settings</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="bg-muted">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
          <TabsTrigger value="display">Display</TabsTrigger>
        </TabsList>

        <TabsContent value="profile" className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Profile</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Display Name</Label>
            <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted border-border" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Experience Level</Label>
            <select value={experience} onChange={(e) => setExperience(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {EXPERIENCE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Trading Style</Label>
            <select value={tradingStyle} onChange={(e) => setTradingStyle(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {STYLE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </TabsContent>

        <TabsContent value="risk" className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Risk Preferences</h2>
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Currency</Label>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
                {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Broker Name</Label>
              <Input value={brokerName} onChange={(e) => setBrokerName(e.target.value)} placeholder="Optional" className="bg-muted border-border" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Default Risk Per Trade (%)</Label>
              <Input type="number" value={defaultRisk} onChange={(e) => setDefaultRisk(Number(e.target.value))} step={0.5} min={0.1} max={10} className="bg-muted border-border" />
              <p className="text-xs text-muted-foreground">Recommended: 1–2%</p>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Max Daily Loss (%)</Label>
              <Input type="number" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(Number(e.target.value))} step={0.5} min={1} max={20} className="bg-muted border-border" />
              <p className="text-xs text-muted-foreground">Recommended: 3–5%</p>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="trading" className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Trading Preferences</h2>
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Preferred Pairs</Label>
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
            <Label className="text-xs text-muted-foreground">Preferred Sessions</Label>
            {SESSIONS.map((s) => (
              <label key={s.value} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
                <Checkbox checked={preferredSessions.includes(s.value)} onCheckedChange={() => toggleSession(s.value)} />
                <span className="text-sm text-foreground">{s.label}</span>
              </label>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Notifications</h2>
          <label className="flex items-center justify-between">
            <div>
              <p className="text-sm text-foreground">Enable Notifications</p>
              <p className="text-xs text-muted-foreground">Receive alerts when new signals match your preferences</p>
            </div>
            <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
          </label>
        </TabsContent>

        <TabsContent value="display" className="rounded-lg border border-border bg-card p-5 space-y-4">
          <h2 className="font-semibold text-foreground">Display</h2>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Timezone</Label>
            <select value={timezone} onChange={(e) => setTimezone(e.target.value)} className="flex h-10 w-full rounded-md border border-border bg-muted px-3 py-2 text-sm text-foreground">
              {TIMEZONES.map((tz) => <option key={tz} value={tz}>{tz}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Theme</Label>
            <p className="text-xs text-muted-foreground">Dark mode is currently the default. Theme switching coming soon.</p>
          </div>
        </TabsContent>
      </Tabs>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Settings"}
      </Button>
    </div>
  );
}
