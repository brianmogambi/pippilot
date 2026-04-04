import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import StatusBadge from "@/components/ui/status-badge";
import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, ImageIcon, CheckCircle2, XCircle, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useState } from "react";
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
  const queryClient = useQueryClient();
  const [deleting, setDeleting] = useState(false);

  if (!entry) return null;

  const pnl = entry.result_pips;
  const isWin = (pnl ?? 0) > 0;

  const handleDelete = async () => {
    setDeleting(true);
    const { error } = await supabase.from("trade_journal_entries").delete().eq("id", entry.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete entry");
    } else {
      toast.success("Entry deleted");
      onOpenChange(false);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
    }
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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            {entry.pair}
            <StatusBadge variant={entry.direction === "long" ? "bullish" : "bearish"}>
              {entry.direction === "long" ? <ArrowUpRight className="h-2.5 w-2.5 mr-0.5" /> : <ArrowDownRight className="h-2.5 w-2.5 mr-0.5" />}
              {entry.direction}
            </StatusBadge>
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
                  {pnl != null ? `${pnl >= 0 ? "+" : ""}${pnl}` : "—"}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-muted-foreground">Result ($)</span>
                <p className={`text-xl font-bold font-mono ${(entry.result_amount ?? 0) >= 0 ? "text-bullish" : "text-bearish"}`}>
                  {entry.result_amount != null ? `${entry.result_amount >= 0 ? "+" : ""}$${Math.abs(entry.result_amount).toFixed(2)}` : "—"}
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

          <Section title="Setup Reasoning" content={entry.setup_reasoning} />
          <Section title="Notes" content={entry.notes} />
          <Section title="Lesson Learned" content={entry.lesson_learned} />
          <Section title="Emotional & Discipline Notes" content={entry.emotional_notes} />

          {/* Screenshot placeholder */}
          <div className="rounded-lg border border-dashed border-border p-6 flex flex-col items-center gap-2 text-muted-foreground">
            <ImageIcon className="h-6 w-6 opacity-40" />
            <span className="text-xs">Screenshot upload coming soon</span>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 gap-1" onClick={() => { onOpenChange(false); onEdit(entry); }}>
              <Pencil className="h-3.5 w-3.5" /> Edit
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" className="gap-1" disabled={deleting}>
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
