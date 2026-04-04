import { useState, useMemo } from "react";
import {
  Bell, CheckCircle2, Clock, XCircle, AlertTriangle, Info,
  Eye, EyeOff, ExternalLink, CheckCheck, Filter,
  Crosshair, Target, ShieldCheck, ArrowRightLeft, Scissors,
  LogOut, Ban, Zap, Newspaper, TriangleAlert,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useAlerts, useMarkAlertRead, useMarkAllAlertsRead } from "@/hooks/use-alerts";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";

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

  const [typeFilter, setTypeFilter] = useState("all");
  const [severityFilter, setSeverityFilter] = useState("all");
  const [readFilter, setReadFilter] = useState("all");
  const [pairFilter, setPairFilter] = useState("all");

  const { data: alerts = [], isLoading } = useAlerts();
  const markRead = useMarkAlertRead();
  const markAllRead = useMarkAllAlertsRead();

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

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-5xl pb-mobile-nav">
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
              <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {Object.entries(alertTypeConfig).map(([key, cfg]) => (
                  <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={severityFilter} onValueChange={setSeverityFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Severity" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severity</SelectItem>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
            <Select value={readFilter} onValueChange={setReadFilter}>
              <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
                <SelectItem value="read">Read</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pairFilter} onValueChange={setPairFilter}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Pair" /></SelectTrigger>
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
          <EmptyState
            icon={Bell}
            title={alerts.length === 0 ? "No alerts yet" : "No alerts match your filters"}
            description={alerts.length === 0
              ? "Alerts will appear here as signals are tracked and market conditions change."
              : "Try adjusting your filters to see more alerts."}
          />
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

      {/* Link to settings for notification prefs */}
      <div className="rounded-lg border border-border/50 bg-card/50 p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">Notification Preferences</p>
          <p className="text-xs text-muted-foreground mt-0.5">Configure alert channels and notification settings</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => navigate("/settings")}>
          Open Settings
        </Button>
      </div>
    </div>
  );
}
