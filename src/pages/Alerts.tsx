import { useState, useMemo } from "react";
import {
  Bell, CheckCircle2, Clock, XCircle, AlertTriangle, Info,
  Eye, EyeOff, ExternalLink, CheckCheck, Filter,
  Crosshair, Target, ShieldCheck, ArrowRightLeft, Scissors,
  LogOut, Ban, Zap, Newspaper, TriangleAlert, Settings,
  Mail, Smartphone, Send,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from "@/hooks/use-alerts";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

// ── Alert type config ──────────────────────────────────────────────
const alertTypeConfig: Record<string, { icon: React.ElementType; label: string }> = {
  setup_forming:        { icon: Crosshair,      label: "Setup Forming" },
  entry_zone_reached:   { icon: Target,          label: "Entry Zone" },
  confirmation_detected:{ icon: ShieldCheck,     label: "Confirmed" },
  move_sl_breakeven:    { icon: ArrowRightLeft,  label: "Move SL to BE" },
  take_partial:         { icon: Scissors,        label: "Take Partial" },
  take_full_exit:       { icon: LogOut,          label: "Full Exit" },
  setup_invalidated:    { icon: Ban,             label: "Invalidated" },
  volatility_spike:     { icon: Zap,             label: "Volatility" },
  news_risk:            { icon: Newspaper,       label: "News Risk" },
  over_risk:            { icon: TriangleAlert,   label: "Over-Risk" },
};

const severityStyles: Record<string, { border: string; bg: string; text: string }> = {
  info:     { border: "border-l-primary",     bg: "bg-primary/10",     text: "text-primary" },
  warning:  { border: "border-l-warning",     bg: "bg-warning/10",     text: "text-warning" },
  critical: { border: "border-l-destructive", bg: "bg-destructive/10", text: "text-destructive" },
};

export default function Alerts() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Filters ──────────────────────────────────────────────────────
  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [pairFilter, setPairFilter] = useState("all");

  // ── Data ─────────────────────────────────────────────────────────
  const { data: alerts = [], isLoading } = useAlerts();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("notifications_enabled")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // ── Mutations ────────────────────────────────────────────────────
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();

  // ── Derived data ─────────────────────────────────────────────────
  const pairs = useMemo(() => [...new Set(alerts.map((a) => a.pair))].sort(), [alerts]);
  const unreadCount = useMemo(() => alerts.filter((a) => !a.is_read).length, [alerts]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (typeFilter !== "all" && a.type !== typeFilter) return false;
      if (severityFilter !== "all" && a.severity !== severityFilter) return false;
      if (readFilter === "unread" && a.is_read) return false;
      if (readFilter === "read" && !a.is_read) return false;
      if (pairFilter !== "all" && a.pair !== pairFilter) return false;
      return true;
    });
  }, [alerts, typeFilter, severityFilter, readFilter, pairFilter]);

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Alert Center</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="text-xs">
                {unreadCount} unread
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Real-time notifications and decision support for your trades
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          disabled={unreadCount === 0 || markAllRead.isPending}
          onClick={() => markAllRead.mutate()}
        >
          <CheckCheck className="h-4 w-4 mr-1.5" />
          Mark All Read
        </Button>
      </div>

      {/* Filters */}
      <Card className="border-border/50">
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground shrink-0" />

            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(alertTypeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>

            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>

            <Select value={pairFilter} onValueChange={setPairFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs">
                <SelectValue placeholder="Pair" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Pairs</SelectItem>
                {pairs.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {(typeFilter !== "all" || severityFilter !== "all" || readFilter !== "all" || pairFilter !== "all") && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={() => { setTypeFilter("all"); setSeverityFilter("all"); setReadFilter("all"); setPairFilter("all"); }}
              >
                Clear
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Alert list */}
      <div className="space-y-2">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)
        ) : filtered.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="p-12 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">
                {alerts.length === 0 ? "No alerts yet" : "No alerts match your filters"}
              </p>
              <p className="text-xs mt-1 opacity-70">
                {alerts.length === 0
                  ? "Alerts will appear here as signals are tracked and market conditions change."
                  : "Try adjusting your filters to see more alerts."}
              </p>
            </CardContent>
          </Card>
        ) : (
          filtered.map((alert) => {
            const sev = severityStyles[alert.severity] ?? severityStyles.info;
            const typeConf = alertTypeConfig[alert.type];
            const TypeIcon = typeConf?.icon ?? Info;

            return (
              <div
                key={alert.id}
                className={`group flex items-start gap-3 rounded-lg border border-border/60 bg-card p-4 transition-colors hover:bg-card/80 border-l-[3px] ${sev.border} ${!alert.is_read ? "bg-card" : "opacity-70"}`}
              >
                <div className={`p-2 rounded-lg shrink-0 ${sev.bg}`}>
                  <TypeIcon className={`h-4 w-4 ${sev.text}`} />
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {!alert.is_read && (
                      <span className="h-2 w-2 rounded-full bg-primary shrink-0" />
                    )}
                    <span className="font-semibold text-sm text-foreground truncate">
                      {alert.title ?? alert.pair}
                    </span>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5">
                      {alert.pair}
                    </Badge>
                    {alert.timeframe && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">
                        {alert.timeframe}
                      </Badge>
                    )}
                    <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded ${sev.bg} ${sev.text}`}>
                      {alert.severity}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {alert.message ?? alert.condition}
                  </p>
                </div>

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true })}
                  </span>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {!alert.is_read && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => markRead.mutate(alert.id)}
                        title="Mark as read"
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    )}
                    {alert.signal_id && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => navigate(`/signals/${alert.signal_id}`)}
                        title="View Signal"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Notification preferences */}
      <Collapsible>
        <Card className="border-border/50">
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-sm font-medium">Notification Preferences</CardTitle>
                </div>
                <span className="text-xs text-muted-foreground">Click to expand</span>
              </div>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="p-4 pt-0 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">In-App Notifications</p>
                    <p className="text-xs text-muted-foreground">Receive alerts inside PipPilot</p>
                  </div>
                </div>
                <Switch checked={profile?.notifications_enabled ?? true} disabled />
              </div>

              <div className="flex items-center justify-between opacity-50">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Email Alerts</p>
                    <p className="text-xs text-muted-foreground">Get critical alerts via email</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
              </div>

              <div className="flex items-center justify-between opacity-50">
                <div className="flex items-center gap-3">
                  <Smartphone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Push Notifications</p>
                    <p className="text-xs text-muted-foreground">Browser and mobile push alerts</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
              </div>

              <div className="flex items-center justify-between opacity-50">
                <div className="flex items-center gap-3">
                  <Send className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Telegram Bot</p>
                    <p className="text-xs text-muted-foreground">Instant alerts to your Telegram</p>
                  </div>
                </div>
                <Badge variant="secondary" className="text-[10px]">Coming Soon</Badge>
              </div>

              <p className="text-xs text-muted-foreground pt-2 border-t border-border/50">
                Manage detailed notification settings in{" "}
                <button onClick={() => navigate("/settings")} className="text-primary hover:underline">
                  Settings
                </button>
              </p>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
