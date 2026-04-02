import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY"];

interface JournalEntryFormProps {
  onSuccess: () => void;
}

export default function JournalEntryForm({ onSuccess }: JournalEntryFormProps) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    pair: "",
    direction: "long",
    entry_price: "",
    exit_price: "",
    stop_loss: "",
    take_profit: "",
    result_pips: "",
    result_amount: "",
    lot_size: "",
    notes: "",
    followed_plan: true,
    status: "closed",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setLoading(true);

    const { error } = await supabase.from("trade_journal_entries").insert({
      user_id: user.id,
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
      closed_at: form.status === "closed" ? new Date().toISOString() : null,
    });

    setLoading(false);
    if (error) {
      toast.error("Failed to add entry");
    } else {
      toast.success("Journal entry added");
      setOpen(false);
      setForm({ pair: "", direction: "long", entry_price: "", exit_price: "", stop_loss: "", take_profit: "", result_pips: "", result_amount: "", lot_size: "", notes: "", followed_plan: true, status: "closed" });
      onSuccess();
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1"><Plus className="h-3.5 w-3.5" /> Add Entry</Button>
      </DialogTrigger>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Journal Entry</DialogTitle>
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
            <Label>Notes</Label>
            <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What did you learn from this trade?" />
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Checkbox id="followed_plan" checked={form.followed_plan} onCheckedChange={(c) => setForm({ ...form, followed_plan: !!c })} />
              <Label htmlFor="followed_plan" className="text-sm">Followed trading plan</Label>
            </div>
            <div className="space-y-1.5">
              <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Open</SelectItem>
                  <SelectItem value="closed">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button type="submit" className="w-full" disabled={loading || !form.pair || !form.entry_price}>
            {loading ? "Saving..." : "Add Entry"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
