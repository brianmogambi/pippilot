import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Filter, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const PAIRS = ["EUR/USD", "GBP/USD", "USD/JPY", "AUD/USD", "USD/CAD", "NZD/USD", "EUR/GBP", "GBP/JPY", "EUR/JPY", "AUD/JPY"];
const SETUP_TYPES = ["breakout", "pullback", "reversal", "range", "trend_continuation"];

/**
 * Phase 18.2: filters gained two new fields —
 *  - accountMode: 'demo' | 'real' | ''  (blank = all)
 *  - source:      'linked' | 'manual' | '' (blank = all)
 * "linked" means the journal entry is tied to an executed_trades row
 * that references a signal; "manual" means no signal origin.
 */
export interface JournalFiltersState {
  pair: string;
  setupType: string;
  result: string;
  accountMode: string;
  source: string;
  dateFrom: string;
  dateTo: string;
}

const defaultFilters: JournalFiltersState = {
  pair: "",
  setupType: "",
  result: "",
  accountMode: "",
  source: "",
  dateFrom: "",
  dateTo: "",
};

interface Props {
  filters: JournalFiltersState;
  onChange: (f: JournalFiltersState) => void;
}

export default function JournalFilters({ filters, onChange }: Props) {
  const activeCount = Object.values(filters).filter(Boolean).length;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Filter className="h-4 w-4 text-muted-foreground" />

      <Select
        value={filters.accountMode || "all"}
        onValueChange={(v) => onChange({ ...filters, accountMode: v === "all" ? "" : v })}
      >
        <SelectTrigger className="w-[120px] h-8 text-xs">
          <SelectValue placeholder="Account Mode" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Modes</SelectItem>
          <SelectItem value="demo">Demo</SelectItem>
          <SelectItem value="real">Real</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={filters.source || "all"}
        onValueChange={(v) => onChange({ ...filters, source: v === "all" ? "" : v })}
      >
        <SelectTrigger className="w-[130px] h-8 text-xs">
          <SelectValue placeholder="Source" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Sources</SelectItem>
          <SelectItem value="linked">Linked to AI</SelectItem>
          <SelectItem value="manual">Manual</SelectItem>
        </SelectContent>
      </Select>

      <Select value={filters.pair || "all"} onValueChange={(v) => onChange({ ...filters, pair: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue placeholder="Pair" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Pairs</SelectItem>
          {PAIRS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.setupType || "all"} onValueChange={(v) => onChange({ ...filters, setupType: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue placeholder="Setup Type" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Setups</SelectItem>
          {SETUP_TYPES.map((s) => <SelectItem key={s} value={s}>{s.replace("_", " ")}</SelectItem>)}
        </SelectContent>
      </Select>

      <Select value={filters.result || "all"} onValueChange={(v) => onChange({ ...filters, result: v === "all" ? "" : v })}>
        <SelectTrigger className="w-[110px] h-8 text-xs"><SelectValue placeholder="Result" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All</SelectItem>
          <SelectItem value="win">Wins</SelectItem>
          <SelectItem value="loss">Losses</SelectItem>
        </SelectContent>
      </Select>

      <Input type="date" className="w-[130px] h-8 text-xs" value={filters.dateFrom} onChange={(e) => onChange({ ...filters, dateFrom: e.target.value })} placeholder="From" />
      <Input type="date" className="w-[130px] h-8 text-xs" value={filters.dateTo} onChange={(e) => onChange({ ...filters, dateTo: e.target.value })} placeholder="To" />

      {activeCount > 0 && (
        <>
          <Badge variant="secondary" className="text-xs">{activeCount} active</Badge>
          <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={() => onChange(defaultFilters)}>
            <X className="h-3 w-3" /> Clear
          </Button>
        </>
      )}
    </div>
  );
}

export { defaultFilters };
