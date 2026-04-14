import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/ui/status-badge";
import AccountModeBadge from "@/components/ui/account-mode-badge";
import TradeAnalysisCard from "@/components/trades/TradeAnalysisCard";
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, ImageIcon, CheckCircle2, XCircle, Star, Link2 } from "lucide-react";
import { useDeleteJournalEntry } from "@/hooks/use-journal";
import { useTradeAnalysisForTrade } from "@/hooks/use-trade-analyses";
import type { AccountMode } from "@/types/trading";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Props {
  entry: any | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onEdit: (entry: any) => void;
}

export default function JournalDetailDrawer({ entry, open, onOpenChange, onEdit }: Props) {
  const deleteMutation = useDeleteJournalEntry();
  // Phase 18.5: pull the rule-engine analysis for the linked trade,
  // if any. Hook is called unconditionally to keep hook order stable;
  // it self-disables when entry?.executed_trade_id is falsy.
  const { data: analysis } = useTradeAnalysisForTrade(entry?.executed_trade_id ?? null);

  if (!entry) return null;

  const pnl = entry.result_pips;
  const isWin = (Number(pnl) ?? 0) > 0;

  const handleDelete = async () => {
    await deleteMutation.mutateAsync(entry.id);
    onOpenChange(false);
  };

  const Section = ({ title, content }: { title: string; content: string | null }) => {
    if (!content) return null;
    return (
      <div className="space-y-1">
        <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{title}</h4>
        <p className="text-sm text-foreground whitespace-pre-wrap">{content}</p>
      </div>
    );
  };

  const mistakeTags: string[] = Array.isArray(entry.mistake_tags) ? entry.mistake_tags : [];
  const ratings = [
    ["Setup", entry.setup_rating],
    ["Execution", entry.execution_rating],
    ["Discipline", entry.discipline_rating],
  ] as const;
  const hasAnyReview =
    ratings.some(([, v]) => v != null) ||
    mistakeTags.length > 0 ||
    entry.emotion_before ||
    entry.emotion_after ||
    entry.screenshot_before ||
    entry.screenshot_after;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2 flex-wrap">
            {entry.pair}
            <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
              {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
              {entry.direction}
            </StatusBadge>
            <AccountModeBadge mode={entry.account_mode as AccountMode} />
            {entry.executed_trade_id && (
              <StatusBadge variant="active" className="gap-1">
                <Link2 className="h-2.5 w-2.5" /> linked
              </StatusBadge>
            )}
            {entry.setup_type && (
              <StatusBadge variant="neutral">{entry.setup_type.replace("_", " ")}</StatusBadge>
            )}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-6 space-y-5">
          {/* Trade summary grid */}
          <div className="grid grid-cols-2 gap-3">
            {[
              ["Entry", entry.entry_price],
              ["Exit", entry.exit_price ?? "—"],
              ["Stop Loss", entry.stop_loss ?? "—"],
              ["Take Profit", entry.take_profit ?? "—"],
              ["Lot Size", entry.lot_size ?? "—"],
              ["Status", entry.status],
            ].map(([label, val]) => (
              <div key={label as string} className="rounded-md border border-border bg-muted/30 p-2.5">
                <span className="text-[10px] text-muted-foreground uppercase">{label as string}</span>
                <p className="text-sm font-mono font-medium text-foreground">{String(val)}</p>
              </div>
            ))}
          </div>

          {/* Result highlight */}
          <div className={`rounded-lg p-4 border ${isWin ? "border-bullish/30 bg-bullish/5" : "border-bearish/30 bg-bearish/5"}`}>
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs text-muted-foreground">Result (pips)</span>
                <p className={`text-xl font-bold font-mono ${isWin ? "text-bullish" : "text-bearish"}`}>
                  {pnl != null ? `${Number(pnl) >= 0 ? "+" : ""}${pnl}` : "—"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Result ($)</span>
                <p className={`text-xl font-bold font-mono ${(Number(entry.result_amount) ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {entry.result_amount != null ? `${Number(entry.result_amount) >= 0 ? "+" : ""}$${Math.abs(Number(entry.result_amount)).toFixed(2)}` : "—"}
                </p>
              </div>
            </div>
          </div>

          {/* Confidence */}
          {entry.confidence && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-muted-foreground mr-1">Confidence:</span>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className={`h-3.5 w-3.5 ${i < entry.confidence ? "text-warning fill-warning" : "text-muted-foreground/30"}`} />
              ))}
            </div>
          )}

          {/* Followed plan */}
          <div className="flex items-center gap-2 text-sm">
            {entry.followed_plan ? (
              <><CheckCircle2 className="h-4 w-4 text-bullish" /><span className="text-foreground">Followed trading plan</span></>
            ) : (
              <><XCircle className="h-4 w-4 text-bearish" /><span className="text-foreground">Did not follow plan</span></>
            )}
          </div>

          <Separator />

          {/* Phase 18.5: rule-engine analysis appears above the
              prose sections so the user sees the structured verdict
              before reading their own notes. */}
          {analysis && <TradeAnalysisCard analysis={analysis} />}

          <Section title="Setup Reasoning" content={entry.setup_reasoning} />
          <Section title="Notes" content={entry.notes} />
          <Section title="Lesson Learned" content={entry.lesson_learned} />
          <Section title="Emotional & Discipline Notes" content={entry.emotional_notes} />

          {/* Phase 18.4: structured review surfaced only when populated. */}
          {hasAnyReview && (
            <>
              <Separator />
              <div className="space-y-3">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Post-trade review
                </h4>

                {ratings.some(([, v]) => v != null) && (
                  <div className="grid grid-cols-3 gap-2">
                    {ratings.map(([label, v]) => (
                      <div key={label} className="rounded-md border border-border bg-muted/30 p-2">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                          {label}
                        </p>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {v != null ? (
                            Array.from({ length: 5 }).map((_, i) => (
                              <Star
                                key={i}
                                className={`h-3 w-3 ${
                                  i < Number(v)
                                    ? "text-warning fill-warning"
                                    : "text-muted-foreground/25"
                                }`}
                              />
                            ))
                          ) : (
                            <span className="text-[10px] text-muted-foreground">—</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {mistakeTags.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      Mistake tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {mistakeTags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full border border-bearish/30 bg-bearish/15 text-bearish px-2 py-0.5 text-[10px] font-medium"
                        >
                          {tag.replace(/_/g, " ")}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {(entry.emotion_before || entry.emotion_after) && (
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {entry.emotion_before && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Emotion before
                        </p>
                        <p className="text-foreground">{entry.emotion_before}</p>
                      </div>
                    )}
                    {entry.emotion_after && (
                      <div>
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
                          Emotion after
                        </p>
                        <p className="text-foreground">{entry.emotion_after}</p>
                      </div>
                    )}
                  </div>
                )}

                {(entry.screenshot_before || entry.screenshot_after) && (
                  <div className="grid grid-cols-2 gap-3">
                    {entry.screenshot_before && (
                      <a
                        href={entry.screenshot_before}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col items-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        <ImageIcon className="h-5 w-5 opacity-60" />
                        <span className="text-[10px]">Before</span>
                      </a>
                    )}
                    {entry.screenshot_after && (
                      <a
                        href={entry.screenshot_after}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="rounded-lg border border-border bg-muted/30 p-3 flex flex-col items-center gap-1 text-muted-foreground hover:border-primary/40 hover:text-foreground transition-colors"
                      >
                        <ImageIcon className="h-5 w-5 opacity-60" />
                        <span className="text-[10px]">After</span>
                      </a>
                    )}
                  </div>
                )}
              </div>
            </>
          )}

          {/* Screenshot placeholder (kept for entries with no structured review) */}
          {!hasAnyReview && (
            <div className="rounded-lg border border-dashed border-border p-6 flex flex-col items-center gap-2 text-muted-foreground">
              <ImageIcon className="h-6 w-6 opacity-40" />
              <span className="text-xs">Close a trade via Open Trades to capture a full review</span>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1" onClick={() => { onOpenChange(false); onEdit(entry); }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-1" disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5" /> Delete
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete journal entry?</AlertDialogTitle>
                  <AlertDialogDescription>This will permanently remove this trade from your journal.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete}>Delete</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>

          <p className="text-[10px] text-muted-foreground text-center">
            Opened {new Date(entry.opened_at).toLocaleDateString()} · Last updated {new Date(entry.updated_at).toLocaleDateString()}
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
