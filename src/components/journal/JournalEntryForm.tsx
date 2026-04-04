import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Star } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY"];
const SETUP_TYPES = ["breakout", "pullback", "reversal", "range", "trend_continuation"];

const emptyForm = {
  pair: "", direction: "long", entry_price: "", exit_price: "", stop_loss: "", take_profit: "",
  result_pips: "", result_amount: "", lot_size: "", notes: "", followed_plan: true, status: "closed",
  setup_type: "", confidence: 0, setup_reasoning: "", lesson_learned: "", emotional_notes: "",
};

interface Props {
  onSuccess: () => void;
  entry?: any | null;
  open?: boolean;
  onOpenChange?: (o: boolean) => void;
}

export default function JournalEntryForm({ onSuccess, entry, open: controlledOpen, onOpenChange }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [internalOpen, setInternalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const isEdit = !!entry;
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    if (entry && open) {
      setForm({
        pair: entry.pair ?? "",
        direction: entry.direction ?? "long",
        entry_price: entry.entry_price?.toString() ?? "",
        exit_price: entry.exit_price?.toString() ?? "",
        stop_loss: entry.stop_loss?.toString() ?? "",
        take_profit: entry.take_profit?.toString() ?? "",
        result_pips: entry.result_pips?.toString() ?? "",
        result_amount: entry.result_amount?.toString() ?? "",
        lot_size: entry.lot_size?.toString() ?? "",
        notes: entry.notes ?? "",
        followed_plan: entry.followed_plan ?? true,
        status: entry.status ?? "closed",
        setup_type: entry.setup_type ?? "",
        confidence: entry.confidence ?? 0,
        setup_reasoning: entry.setup_reasoning ?? "",
        lesson_learned: entry.lesson_learned ?? "",
        emotional_notes: entry.emotional_notes ?? "",
      });
    } else if (!entry && !open) {
      setForm(emptyForm);
    }
  }, [entry, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const payload: any = {
      pair: form.pair,
      direction: form.direction,
      entry_price: parseFloat(form.entry_price),
      exit_price: form.exit_price ? parseFloat(form.exit_price) : null,
      stop_loss: form.stop_loss ? parseFloat(form.stop_loss) : null,
      take_profit: form.take_profit ? parseFloat(form.take_profit) : null,
      result_pips: form.result_pips ? parseFloat(form.result_pips) : null,
      result_amount: form.result_amount ? parseFloat(form.result_amount) : null,
      lot_size: form.lot_size ? parseFloat(form.lot_size) : null,
      notes: form.notes || null,
      followed_plan: form.followed_plan,
      status: form.status,
      setup_type: form.setup_type || null,
      confidence: form.confidence || null,
      setup_reasoning: form.setup_reasoning || null,
      lesson_learned: form.lesson_learned || null,
      emotional_notes: form.emotional_notes || null,
    };

    let error;
    if (isEdit) {
      ({ error } = await supabase.from("trade_journal_entries").update(payload).eq("id", entry.id));
    } else {
      payload.user_id = user.id;
      payload.closed_at = form.status === "closed" ? new Date().toISOString() : null;
      ({ error } = await supabase.from("trade_journal_entries").insert(payload));
    }

    setLoading(false);
    if (error) {
      toast.error(`Failed to ${isEdit ? "update" : "add"} entry`);
    } else {
      toast.success(`Journal entry ${isEdit ? "updated" : "added"}`);
      setOpen(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["journal-entries"] });
      onSuccess();
    }
  };

  const trigger = !isEdit ? (
    <DialogTrigger asChild>
      <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Entry</Button>
    </DialogTrigger>
  ) : null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger}
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Journal Entry" : "New Journal Entry"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Pair</Label>
              <Select value={form.pair} onValueChange={(v) => setForm({ ...form, pair: v })}>
                <SelectTrigger><SelectValue placeholder="Select pair" /></SelectTrigger>
                <SelectContent>{PAIRS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Direction</Label>
              <Select value={form.direction} onValueChange={(v) => setForm({ ...form, direction: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="long">Long</SelectItem>
                  <SelectItem value="short">Short</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Setup Type</Label>
              <Select value={form.setup_type || "none"} onValueChange={(v) => setForm({ ...form, setup_type: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="Select setup" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {SETUP_TYPES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Confidence</Label>
              <div className="flex items-center gap-1 h-10 px-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} type="button" onClick={() => setForm({ ...form, confidence: form.confidence === n ? 0 : n })}>
                    <Star className={`h-5 w-5 transition-colors ${n <= form.confidence ? "text-warning fill-warning" : "text-muted-foreground/30 hover:text-muted-foreground"}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Entry Price *</Label>
              <Input type="number" step="any" required value={form.entry_price} onChange={(e) => setForm({ ...form, entry_price: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Exit Price</Label>
              <Input type="number" step="any" value={form.exit_price} onChange={(e) => setForm({ ...form, exit_price: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Stop Loss</Label>
              <Input type="number" step="any" value={form.stop_loss} onChange={(e) => setForm({ ...form, stop_loss: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Take Profit</Label>
              <Input type="number" step="any" value={form.take_profit} onChange={(e) => setForm({ ...form, take_profit: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Result (pips)</Label>
              <Input type="number" step="any" value={form.result_pips} onChange={(e) => setForm({ ...form, result_pips: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Result ($)</Label>
              <Input type="number" step="any" value={form.result_amount} onChange={(e) => setForm({ ...form, result_amount: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label>Lot Size</Label>
              <Input type="number" step="any" value={form.lot_size} onChange={(e) => setForm({ ...form, lot_size: e.target.value })} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Setup Reasoning</Label>
            <Textarea value={form.setup_reasoning} onChange={(e) => setForm({ ...form, setup_reasoning: e.target.value })} placeholder="Why did you take this trade?" className="min-h-[60px]" />
          </div>

          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="General observations" className="min-h-[60px]" />
          </div>

          <div className="space-y-1.5">
            <Label>Lesson Learned</Label>
            <Textarea value={form.lesson_learned} onChange={(e) => setForm({ ...form, lesson_learned: e.target.value })} placeholder="What did you learn?" className="min-h-[60px]" />
          </div>

          <div className="space-y-1.5">
            <Label>Emotional & Discipline Notes</Label>
            <Textarea value={form.emotional_notes} onChange={(e) => setForm({ ...form, emotional_notes: e.target.value })} placeholder="How did you feel? Did you stick to rules?" className="min-h-[60px]" />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="followed_plan" checked={form.followed_plan} onCheckedChange={(c) => setForm({ ...form, followed_plan: !!c })} />
              <Label htmlFor="followed_plan" className="text-sm">Followed trading plan</Label>
            </div>
            <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
              <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.pair || !form.entry_price}>
            {loading ? "Saving..." : isEdit ? "Update Entry" : "Add Entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
