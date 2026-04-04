import { useState } from "react";
import { Navigate } from "react-router-dom";
import { format } from "date-fns";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import EmptyState from "@/components/ui/empty-state";
import ReviewTagSelect from "@/components/admin/ReviewTagSelect";
import ReviewNotesPopover from "@/components/admin/ReviewNotesPopover";
import {
  useIsAdmin,
  useAdminSignals,
  useAdminAlerts,
  useReviewSignal,
  useReviewAlert,
  useSignalReviewStats,
} from "@/hooks/use-admin";
import { ShieldCheck, TrendingUp, Bell } from "lucide-react";

const ALL = "__all__";

function StatBox({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center p-3 rounded-lg bg-muted/30 border border-border min-w-[100px]">
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function AdminReview() {
  const { isAdmin, isLoading: roleLoading } = useIsAdmin();

  const [sPair, setSPair] = useState(ALL);
  const [sStatus, setSStatus] = useState(ALL);
  const [sSetup, setSSetup] = useState(ALL);
  const [sTag, setSTag] = useState(ALL);

  const [aPair, setAPair] = useState(ALL);
  const [aType, setAType] = useState(ALL);
  const [aSev, setASev] = useState(ALL);
  const [aTag, setATag] = useState(ALL);

  const signalFilters = {
    pair: sPair !== ALL ? sPair : undefined,
    status: sStatus !== ALL ? sStatus : undefined,
    setupType: sSetup !== ALL ? sSetup : undefined,
    reviewTag: sTag !== ALL ? sTag : undefined,
  };
  const alertFilters = {
    pair: aPair !== ALL ? aPair : undefined,
    type: aType !== ALL ? aType : undefined,
    severity: aSev !== ALL ? aSev : undefined,
    reviewTag: aTag !== ALL ? aTag : undefined,
  };

  const { data: signals = [], isLoading: sigLoading } = useAdminSignals(signalFilters);
  const { data: alerts = [], isLoading: alertLoading } = useAdminAlerts(alertFilters);
  const reviewSignal = useReviewSignal();
  const reviewAlert = useReviewAlert();
  const stats = useSignalReviewStats(signals);

  if (roleLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Skeleton className="h-8 w-8 rounded-full" />
      </div>
    );
  }

  if (!isAdmin) return <Navigate to="/" replace />;

  const uniquePairs = [...new Set(signals.map((s) => s.pair))].sort();
  const uniqueSetups = [...new Set(signals.map((s) => s.setup_type).filter(Boolean))].sort();

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 pb-mobile-nav">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Review Panel</h1>
        <p className="text-sm text-muted-foreground mt-1">Internal signal & alert quality review</p>
      </div>

      <Tabs defaultValue="signals">
        <TabsList>
          <TabsTrigger value="signals">Signals ({signals.length})</TabsTrigger>
          <TabsTrigger value="alerts">Alerts ({alerts.length})</TabsTrigger>
        </TabsList>

        {/* SIGNALS TAB */}
        <TabsContent value="signals" className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <StatBox label="Total" value={stats.total} />
            <StatBox label="Reviewed" value={`${stats.reviewedPct}%`} />
            <StatBox label="Good Rate" value={`${stats.goodRate}%`} />
            <StatBox label="Good" value={stats.good} />
            <StatBox label="False Pos." value={stats.falsePositive} />
            <StatBox label="Avg Conf ✅" value={stats.avgConfGood} />
            <StatBox label="Avg Conf ❌" value={stats.avgConfFP} />
          </div>

          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Pair" value={sPair} onChange={setSPair} options={uniquePairs} />
            <FilterSelect label="Status" value={sStatus} onChange={setSStatus} options={["active", "expired", "invalidated"]} />
            <FilterSelect label="Setup" value={sSetup} onChange={setSSetup} options={uniqueSetups as string[]} />
            <FilterSelect label="Review" value={sTag} onChange={setSTag} options={["unreviewed", "good_signal", "false_positive", "needs_review"]} />
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              {sigLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : signals.length === 0 ? (
                <EmptyState icon={TrendingUp} title="No signals match filters" description="Try adjusting your filter criteria." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Pair</TableHead>
                        <TableHead className="text-xs">Dir</TableHead>
                        <TableHead className="text-xs">TF</TableHead>
                        <TableHead className="text-xs">Setup</TableHead>
                        <TableHead className="text-xs">Conf</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">R:R</TableHead>
                        <TableHead className="text-xs">Tag</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {signals.map((s) => {
                        const rr = s.stop_loss !== s.entry_price
                          ? Math.abs((s.take_profit_1 - s.entry_price) / (s.stop_loss - s.entry_price)).toFixed(1)
                          : "—";
                        return (
                          <TableRow key={s.id}>
                            <TableCell className="font-medium text-sm">{s.pair}</TableCell>
                            <TableCell>
                              <Badge variant={s.direction === "buy" ? "default" : "destructive"} className="text-[10px]">
                                {s.direction.toUpperCase()}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.timeframe}</TableCell>
                            <TableCell className="text-xs text-muted-foreground">{s.setup_type ?? "—"}</TableCell>
                            <TableCell className="text-xs">{s.confidence}%</TableCell>
                            <TableCell className="text-xs capitalize">{s.status}</TableCell>
                            <TableCell className="text-xs font-mono">{rr}</TableCell>
                            <TableCell>
                              <ReviewTagSelect
                                value={s.review_tag ?? null}
                                onValueChange={(tag) => reviewSignal.mutate({ id: s.id, review_tag: tag })}
                                disabled={reviewSignal.isPending}
                              />
                            </TableCell>
                            <TableCell>
                              <ReviewNotesPopover
                                notes={s.review_notes ?? null}
                                onSave={(notes) => reviewSignal.mutate({ id: s.id, review_tag: s.review_tag ?? null, review_notes: notes })}
                                saving={reviewSignal.isPending}
                              />
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ALERTS TAB */}
        <TabsContent value="alerts" className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <FilterSelect label="Pair" value={aPair} onChange={setAPair} options={[...new Set(alerts.map((a) => a.pair))].sort()} />
            <FilterSelect label="Type" value={aType} onChange={setAType} options={[...new Set(alerts.map((a) => a.type))].sort()} />
            <FilterSelect label="Severity" value={aSev} onChange={setASev} options={["info", "warning", "critical"]} />
            <FilterSelect label="Review" value={aTag} onChange={setATag} options={["unreviewed", "good_signal", "false_positive", "needs_review"]} />
          </div>

          <Card className="border-border/50">
            <CardContent className="p-0">
              {alertLoading ? (
                <div className="p-6 space-y-3">
                  {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-12 w-full" />)}
                </div>
              ) : alerts.length === 0 ? (
                <EmptyState icon={Bell} title="No alerts match filters" description="Try adjusting your filter criteria." />
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="sticky top-0 z-10">
                      <TableRow className="bg-muted/30">
                        <TableHead className="text-xs">Title</TableHead>
                        <TableHead className="text-xs">Pair</TableHead>
                        <TableHead className="text-xs">Type</TableHead>
                        <TableHead className="text-xs">Severity</TableHead>
                        <TableHead className="text-xs">Status</TableHead>
                        <TableHead className="text-xs">Created</TableHead>
                        <TableHead className="text-xs">Tag</TableHead>
                        <TableHead className="text-xs">Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {alerts.map((a) => (
                        <TableRow key={a.id}>
                          <TableCell className="font-medium text-xs">{a.title ?? a.condition}</TableCell>
                          <TableCell className="text-xs">{a.pair}</TableCell>
                          <TableCell className="text-xs capitalize">{a.type}</TableCell>
                          <TableCell>
                            <Badge
                              variant={a.severity === "critical" ? "destructive" : a.severity === "warning" ? "secondary" : "outline"}
                              className="text-[10px]"
                            >
                              {a.severity}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs capitalize">{a.status}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{format(new Date(a.created_at), "MMM d, HH:mm")}</TableCell>
                          <TableCell>
                            <ReviewTagSelect
                              value={a.review_tag ?? null}
                              onValueChange={(tag) => reviewAlert.mutate({ id: a.id, review_tag: tag })}
                              disabled={reviewAlert.isPending}
                            />
                          </TableCell>
                          <TableCell>
                            <ReviewNotesPopover
                              notes={a.review_notes ?? null}
                              onSave={(notes) => reviewAlert.mutate({ id: a.id, review_tag: a.review_tag ?? null, review_notes: notes })}
                              saving={reviewAlert.isPending}
                            />
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="w-[140px] h-8 text-xs">
        <SelectValue placeholder={label} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__all__">All {label}s</SelectItem>
        {options.map((o) => (
          <SelectItem key={o} value={o}>
            {o.replace(/_/g, " ")}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
