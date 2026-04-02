import { Bell, CheckCircle2, Clock, XCircle, AlertTriangle, Info } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Skeleton } from "@/components/ui/skeleton";

const statusConfig = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Pending" },
  triggered: { icon: CheckCircle2, color: "text-bullish", bg: "bg-bullish/10", label: "Triggered" },
  expired: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted", label: "Expired" },
};

const severityIcons = {
  info: Info,
  warning: AlertTriangle,
  critical: AlertTriangle,
};

export default function Alerts() {
  const { user } = useAuth();

  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your configured price alerts</p>
      </div>

      <div className="space-y-3">
        {isLoading ? (
          [1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)
        ) : alerts.length === 0 ? (
          <div className="rounded-lg border border-border bg-card p-12 text-center text-muted-foreground">
            <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No alerts yet. Alerts will appear here when signals are tracked.</p>
          </div>
        ) : (
          alerts.map((alert) => {
            const config = statusConfig[alert.status as keyof typeof statusConfig] ?? statusConfig.pending;
            const Icon = config.icon;
            const SeverityIcon = severityIcons[(alert.severity as keyof typeof severityIcons)] ?? Info;
            return (
              <div key={alert.id} className={`flex items-center gap-4 rounded-lg border border-border bg-card p-4 ${alert.is_read === false ? "border-l-2 border-l-primary" : ""}`}>
                <div className={`p-2 rounded-lg ${config.bg}`}>
                  <Icon className={`h-4 w-4 ${config.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm text-foreground">{alert.title ?? alert.pair}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                    {alert.severity === "critical" && <SeverityIcon className="h-3.5 w-3.5 text-bearish" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.message ?? alert.condition}</p>
                </div>
                <span className="text-xs text-muted-foreground whitespace-nowrap">
                  {new Date(alert.created_at).toLocaleDateString()}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
