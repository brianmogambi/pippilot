import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Save,
  User,
  BarChart3,
  Shield,
  Bell,
  Palette,
  TrendingUp,
  Wallet,
} from "lucide-react";
import {
  useTradingAccounts,
  useUpdateTradingAccount,
} from "@/hooks/use-account";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import type { AccountMode } from "@/types/trading";

const EXPERIENCE_OPTIONS = [
  { value: "beginner", label: "Beginner", desc: "New to forex — guided recommendations" },
  { value: "intermediate", label: "Intermediate", desc: "Familiar with setups and risk management" },
  { value: "advanced", label: "Advanced", desc: "Full control, minimal hand-holding" },
];

const STYLE_OPTIONS = [
  { value: "scalping", label: "Scalping" },
  { value: "intraday", label: "Intraday" },
  { value: "swing", label: "Swing" },
];

const TIMEFRAMES = [
  { value: "M5", label: "M5" },
  { value: "M15", label: "M15" },
  { value: "H1", label: "H1" },
  { value: "H4", label: "H4" },
  { value: "D1", label: "D1" },
];

const MAJOR_PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/CHF", "AUD/USD", "NZD/USD", "USD/CAD"];
const MINOR_PAIRS = ["EUR/GBP", "EUR/JPY", "GBP/JPY", "AUD/JPY", "EUR/AUD", "GBP/AUD"];

const SESSIONS = [
  { value: "london", label: "London", desc: "08:00–16:00 GMT — highest forex volume" },
  { value: "new_york", label: "New York", desc: "13:00–21:00 GMT — overlaps with London" },
  { value: "asia", label: "Asia / Tokyo", desc: "00:00–08:00 GMT — quieter, range-bound" },
];

const STRATEGIES = [
  { value: "trend_pullback", label: "Trend Pullback", desc: "Enter trends during temporary retracements" },
  { value: "breakout_retest", label: "Breakout Retest", desc: "Trade breakouts after price retests the level" },
  { value: "range_reversal", label: "Range Reversal", desc: "Fade moves at range boundaries" },
  { value: "momentum_breakout", label: "Momentum Breakout", desc: "Catch strong directional moves" },
  { value: "sr_rejection", label: "S/R Rejection", desc: "Trade bounces off key support/resistance" },
];

const ALERT_CHANNELS = [
  { value: "in_app", label: "In-App", available: true },
  { value: "email", label: "Email", available: true },
  { value: "telegram", label: "Telegram", available: true },
  { value: "push", label: "Push", available: false },
];

const SEVERITIES = ["info", "warning", "critical"] as const;
const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  warning: "Warning",
  critical: "Critical",
};
const OUTBOUND_CHANNELS = ["email", "telegram"] as const;

const CURRENCIES = ["USD", "EUR", "GBP", "AUD", "CAD", "JPY", "CHF", "NZD"];

const TIMEZONES = [
  "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Europe/London", "Europe/Berlin", "Europe/Moscow", "Asia/Tokyo",
  "Asia/Shanghai", "Asia/Singapore", "Australia/Sydney",
];

function SectionCard({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="font-semibold text-foreground">{title}</h2>
      </div>
      {children}
    </div>
  );
}

export default function SettingsPage() {
  const { profile, user, refetchProfile } = useAuth();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  // Phase 18.2: trading accounts list for the Accounts section.
  const { data: accounts = [] } = useTradingAccounts();
  const updateAccount = useUpdateTradingAccount();

  const [displayName, setDisplayName] = useState("");
  const [experience, setExperience] = useState("beginner");
  const [tradingStyle, setTradingStyle] = useState("intraday");

  const [defaultTimeframe, setDefaultTimeframe] = useState("H1");
  const [preferredPairs, setPreferredPairs] = useState<string[]>([]);
  const [preferredSessions, setPreferredSessions] = useState<string[]>([]);

  const [preferredStrategies, setPreferredStrategies] = useState<string[]>([]);

  const [currency, setCurrency] = useState("USD");
  const [brokerName, setBrokerName] = useState("");
  const [accountBalance, setAccountBalance] = useState(10000);
  const [accountEquity, setAccountEquity] = useState(10000);
  const [defaultRisk, setDefaultRisk] = useState(1);
  const [maxDailyLoss, setMaxDailyLoss] = useState(5);
  const [conservativeMode, setConservativeMode] = useState(false);

  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [alertChannels, setAlertChannels] = useState<string[]>(["in_app"]);
  const [telegramChatId, setTelegramChatId] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");
  const [severityRouting, setSeverityRouting] = useState<Record<string, string[]> | null>(null);

  const [timezone, setTimezone] = useState("UTC");

  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setExperience(profile.experience_level || "beginner");
      setTradingStyle(profile.trading_style || "intraday");
      setDefaultTimeframe(profile.default_timeframe || "H1");
      setCurrency(profile.account_currency || "USD");
      setBrokerName(profile.broker_name || "");
      setAccountBalance(profile.account_size || 10000);
      setAccountEquity(profile.account_equity || 10000);
      setDefaultRisk(profile.default_risk_pct || 1);
      setMaxDailyLoss(profile.max_daily_loss_pct || 5);
      setPreferredPairs(profile.preferred_pairs || []);
      setPreferredSessions(profile.preferred_sessions || []);
      setPreferredStrategies(profile.preferred_strategies || []);
      setNotificationsEnabled(profile.notifications_enabled ?? true);
      setAlertChannels(profile.alert_channels || ["in_app"]);
      setTelegramChatId(profile.telegram_chat_id || "");
      setNotificationEmail(profile.notification_email || "");
      setSeverityRouting(profile.severity_channel_routing as Record<string, string[]> | null);
      setTimezone(profile.timezone || "UTC");
    }
  }, [profile]);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_risk_profiles").select("conservative_mode").eq("user_id", user.id).maybeSingle()
      .then(({ data }) => { if (data) setConservativeMode(data.conservative_mode); });
  }, [user]);

  const toggleItem = (list: string[], setList: (v: string[]) => void, item: string) =>
    setList(list.includes(item) ? list.filter((x) => x !== item) : [...list, item]);

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);

    const [profileResult, riskResult] = await Promise.all([
      supabase.from("profiles").update({
        display_name: displayName,
        experience_level: experience,
        trading_style: tradingStyle,
        default_timeframe: defaultTimeframe,
        account_currency: currency,
        broker_name: brokerName || null,
        account_size: accountBalance,
        account_equity: accountEquity,
        default_risk_pct: defaultRisk,
        max_daily_loss_pct: maxDailyLoss,
        preferred_pairs: preferredPairs,
        preferred_sessions: preferredSessions,
        preferred_strategies: preferredStrategies,
        notifications_enabled: notificationsEnabled,
        alert_channels: alertChannels,
        telegram_chat_id: telegramChatId || null,
        notification_email: notificationEmail || null,
        severity_channel_routing: severityRouting,
        timezone,
      }).eq("user_id", user.id),
      supabase.from("user_risk_profiles").update({
        conservative_mode: conservativeMode,
      }).eq("user_id", user.id),
    ]);

    setSaving(false);
    const error = profileResult.error || riskResult.error;
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      await refetchProfile();
      toast({ title: "Settings saved" });
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-3xl pb-mobile-nav">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your profile, trading preferences, and app settings</p>
      </div>

      {/* Section 1: Profile */}
      <SectionCard icon={User} title="Profile">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Display Name</Label>
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="bg-muted border-border" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Email</Label>
          <Input value={user?.email || ""} disabled className="bg-muted/50 border-border opacity-60" />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Experience Level</Label>
          <div className="grid gap-2">
            {EXPERIENCE_OPTIONS.map((o) => (
              <label
                key={o.value}
                className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${experience === o.value ? "border-primary bg-primary/10" : "border-border bg-muted/50 hover:border-muted-foreground/30"}`}
                onClick={() => setExperience(o.value)}
              >
                <div className={`h-4 w-4 rounded-full border-2 flex items-center justify-center ${experience === o.value ? "border-primary" : "border-muted-foreground/40"}`}>
                  {experience === o.value && <div className="h-2 w-2 rounded-full bg-primary" />}
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground">{o.label}</span>
                  <p className="text-xs text-muted-foreground">{o.desc}</p>
                </div>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Trading Style</Label>
          <Select value={tradingStyle} onValueChange={setTradingStyle}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {STYLE_OPTIONS.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </SectionCard>

      {/* Section 2: Trading Accounts (Phase 18.2) */}
      <SectionCard icon={Wallet} title="Trading Accounts">
        <p className="text-xs text-muted-foreground">
          Mark each account as <span className="font-medium text-warning">Demo</span> or{" "}
          <span className="font-medium text-bullish">Real</span>. PipPilot keeps demo and real
          performance separate across the journal, analytics, and dashboard so practice trades
          never pollute your real stats.
        </p>
        {accounts.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            No trading accounts yet. One will be created automatically on your first trade.
          </p>
        ) : (
          <div className="space-y-2">
            {accounts.map((acct) => {
              const currentMode = (acct.account_mode as AccountMode) ?? "demo";
              return (
                <div
                  key={acct.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-muted/40 p-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-foreground truncate">
                        {acct.account_name}
                      </span>
                      {acct.is_default && (
                        <span className="text-[10px] rounded bg-primary/15 text-primary px-1.5 py-0.5 uppercase tracking-wider">
                          Default
                        </span>
                      )}
                      <AccountModeBadge mode={currentMode} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {acct.broker_name || "No broker"} · {acct.account_currency}{" "}
                      {Number(acct.balance).toLocaleString()}
                    </p>
                  </div>
                  <Select
                    value={currentMode}
                    disabled={updateAccount.isPending}
                    onValueChange={(v) =>
                      updateAccount.mutate({
                        id: acct.id,
                        payload: { account_mode: v as AccountMode },
                      })
                    }
                  >
                    <SelectTrigger className="w-[110px] h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="demo">Demo</SelectItem>
                      <SelectItem value="real">Real</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
          </div>
        )}
      </SectionCard>

      {/* Section 3: Trading Preferences */}
      <SectionCard icon={BarChart3} title="Trading Preferences">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Default Timeframe</Label>
          <div className="flex gap-2">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setDefaultTimeframe(tf.value)}
                className={`rounded-md border px-4 py-2 text-xs font-medium transition-colors ${defaultTimeframe === tf.value ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30"}`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preferred Pairs — Majors</Label>
          <div className="flex flex-wrap gap-2">
            {MAJOR_PAIRS.map((pair) => (
              <button key={pair} onClick={() => toggleItem(preferredPairs, setPreferredPairs, pair)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${preferredPairs.includes(pair) ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30"}`}>
                {pair}
              </button>
            ))}
          </div>
          <Label className="text-xs text-muted-foreground">Minors</Label>
          <div className="flex flex-wrap gap-2">
            {MINOR_PAIRS.map((pair) => (
              <button key={pair} onClick={() => toggleItem(preferredPairs, setPreferredPairs, pair)}
                className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${preferredPairs.includes(pair) ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/50 text-muted-foreground hover:border-muted-foreground/30"}`}>
                {pair}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Preferred Sessions</Label>
          {SESSIONS.map((s) => (
            <label key={s.value} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
              <Checkbox checked={preferredSessions.includes(s.value)} onCheckedChange={() => toggleItem(preferredSessions, setPreferredSessions, s.value)} />
              <div>
                <span className="text-sm text-foreground">{s.label}</span>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Section 3: Strategy Preferences */}
      <SectionCard icon={TrendingUp} title="Strategy Preferences">
        <p className="text-xs text-muted-foreground">Enable the strategies PipPilot AI should prioritise in signal generation.</p>
        <div className="space-y-2">
          {STRATEGIES.map((s) => (
            <label key={s.value} className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
              <div>
                <span className="text-sm font-medium text-foreground">{s.label}</span>
                <p className="text-xs text-muted-foreground">{s.desc}</p>
              </div>
              <Switch checked={preferredStrategies.includes(s.value)} onCheckedChange={() => toggleItem(preferredStrategies, setPreferredStrategies, s.value)} />
            </label>
          ))}
        </div>
      </SectionCard>

      {/* Section 4: Risk Preferences */}
      <SectionCard icon={Shield} title="Risk Preferences">
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
            <Select value={currency} onValueChange={setCurrency}>
              <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CURRENCIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
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
            <p className="text-[10px] text-muted-foreground">Recommended: 1–2%</p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Max Daily Loss (%)</Label>
            <Input type="number" value={maxDailyLoss} onChange={(e) => setMaxDailyLoss(Number(e.target.value))} step={0.5} min={1} max={20} className="bg-muted border-border" />
            <p className="text-[10px] text-muted-foreground">Recommended: 3–5%</p>
          </div>
        </div>
        <label className="flex items-center justify-between rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
          <div>
            <span className="text-sm font-medium text-foreground">Conservative Mode</span>
            <p className="text-xs text-muted-foreground">Tighter risk limits — caps position sizes and reduces max open risk</p>
          </div>
          <Switch checked={conservativeMode} onCheckedChange={setConservativeMode} />
        </label>
      </SectionCard>

      {/* Section 5: Notification Preferences */}
      <SectionCard icon={Bell} title="Notification Preferences">
        <label className="flex items-center justify-between">
          <div>
            <p className="text-sm text-foreground">Enable Notifications</p>
            <p className="text-xs text-muted-foreground">Receive alerts when new signals match your preferences</p>
          </div>
          <Switch checked={notificationsEnabled} onCheckedChange={setNotificationsEnabled} />
        </label>
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Alert Channels</Label>
          {ALERT_CHANNELS.map((ch) => (
            <label key={ch.value} className="flex items-center gap-3 rounded-lg border border-border bg-muted/50 p-3 cursor-pointer hover:border-muted-foreground/30 transition-colors">
              <Checkbox
                checked={alertChannels.includes(ch.value)}
                onCheckedChange={() => ch.available && toggleItem(alertChannels, setAlertChannels, ch.value)}
                disabled={!ch.available}
              />
              <div className="flex items-center gap-2">
                <span className={`text-sm ${ch.available ? "text-foreground" : "text-muted-foreground"}`}>{ch.label}</span>
                {!ch.available && <span className="text-[10px] rounded bg-muted px-1.5 py-0.5 text-muted-foreground">Coming soon</span>}
              </div>
            </label>
          ))}
        </div>

        {alertChannels.includes("email") && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Notification Email</Label>
            <Input
              type="email"
              value={notificationEmail}
              onChange={(e) => setNotificationEmail(e.target.value)}
              placeholder="Uses your login email by default"
              className="bg-muted border-border"
            />
          </div>
        )}

        {alertChannels.includes("telegram") && (
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Telegram Chat ID</Label>
            <Input
              value={telegramChatId}
              onChange={(e) => setTelegramChatId(e.target.value.replace(/[^0-9-]/g, ""))}
              placeholder="e.g. 123456789"
              className="bg-muted border-border"
            />
            <p className="text-[10px] text-muted-foreground">
              Message <span className="font-medium">/start</span> to <span className="font-medium">@PipPilotBot</span> on Telegram to get your Chat ID
            </p>
          </div>
        )}

        {alertChannels.some((ch) => ch === "email" || ch === "telegram") && (
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Severity Routing</Label>
            <p className="text-[10px] text-muted-foreground">Choose which channels receive each severity level. When unconfigured, all enabled channels receive all alerts.</p>
            <div className="rounded-lg border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/50">
                    <th className="text-left p-2 text-xs text-muted-foreground font-medium">Severity</th>
                    {OUTBOUND_CHANNELS.filter((ch) => alertChannels.includes(ch)).map((ch) => (
                      <th key={ch} className="text-center p-2 text-xs text-muted-foreground font-medium capitalize">{ch}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {SEVERITIES.map((sev) => (
                    <tr key={sev} className="border-t border-border">
                      <td className="p-2 text-xs text-foreground">{SEVERITY_LABELS[sev]}</td>
                      {OUTBOUND_CHANNELS.filter((ch) => alertChannels.includes(ch)).map((ch) => {
                        const routing = severityRouting ?? {};
                        const channels = routing[sev] ?? [];
                        const checked = !severityRouting || channels.includes(ch);
                        return (
                          <td key={ch} className="text-center p-2">
                            <Checkbox
                              checked={checked}
                              onCheckedChange={() => {
                                const prev = severityRouting ? { ...severityRouting } : Object.fromEntries(SEVERITIES.map((s) => [s, OUTBOUND_CHANNELS.filter((c) => alertChannels.includes(c)).slice()]));
                                const list = prev[sev] ?? [];
                                prev[sev] = checked ? list.filter((c) => c !== ch) : [...list, ch];
                                setSeverityRouting(prev);
                              }}
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </SectionCard>

      {/* Section 6: Appearance */}
      <SectionCard icon={Palette} title="Appearance">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className="bg-muted border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              {TIMEZONES.map((tz) => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Theme</Label>
          <p className="text-xs text-muted-foreground">Dark mode is currently the default. Theme switching coming soon.</p>
        </div>
      </SectionCard>

      {/* Sticky save on mobile */}
      <div className="sticky bottom-16 md:bottom-0 z-30">
        <Button onClick={handleSave} disabled={saving} className="w-full shadow-lg">
          <Save className="h-4 w-4 mr-2" /> {saving ? "Saving..." : "Save Settings"}
        </Button>
      </div>
    </div>
  );
}
