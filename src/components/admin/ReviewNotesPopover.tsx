import { useState } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MessageSquare } from "lucide-react";

interface Props {
  notes: string | null;
  onSave: (notes: string) => void;
  saving?: boolean;
}

export default function ReviewNotesPopover({ notes, onSave, saving }: Props) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(notes ?? "");

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (o) setDraft(notes ?? ""); }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative">
          <MessageSquare className="h-4 w-4" />
          {notes && <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-primary" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Add review notes…"
          rows={3}
          className="text-xs mb-2"
        />
        <Button
          size="sm"
          className="w-full"
          disabled={saving}
          onClick={() => { onSave(draft); setOpen(false); }}
        >
          {saving ? "Saving…" : "Save Notes"}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
