import { Bell, CheckCircle2, Clock, XCircle } from "lucide-react";
import { mockAlerts } from "@/data/mockSignals";

const statusConfig = {
  pending: { icon: Clock, color: "text-warning", bg: "bg-warning/10", label: "Pending" },
  triggered: { icon: CheckCircle2, color: "text-bullish", bg: "bg-bullish/10", label: "Triggered" },
  expired: { icon: XCircle, color: "text-muted-foreground", bg: "bg-muted", label: "Expired" },
};

export default function Alerts() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Alerts</h1>
        <p className="text-sm text-muted-foreground mt-1">Track your configured price alerts</p>
      </div>

      <div className="space-y-3">
        {mockAlerts.map((alert) => {
          const config = statusConfig[alert.status];
          const Icon = config.icon;
          return (
            <div key={alert.id} className="flex items-center gap-4 rounded-lg border border-border bg-card p-4">
              <div className={`p-2 rounded-lg ${config.bg}`}>
                <Icon className={`h-4 w-4 ${config.color}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm text-foreground">{alert.pair}</span>
                  <span className={`text-xs px-1.5 py-0.5 rounded ${config.bg} ${config.color}`}>{config.label}</span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{alert.condition}</p>
              </div>
              <span className="text-xs text-muted-foreground whitespace-nowrap">
                {new Date(alert.created_at).toLocaleDateString()}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
