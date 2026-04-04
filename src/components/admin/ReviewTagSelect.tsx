import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const tags = [
  { value: "good_signal", label: "✅ Good Signal" },
  { value: "false_positive", label: "❌ False Positive" },
  { value: "needs_review", label: "🔍 Needs Review" },
];

interface Props {
  value: string | null;
  onValueChange: (value: string | null) => void;
  disabled?: boolean;
}

export default function ReviewTagSelect({ value, onValueChange, disabled }: Props) {
  return (
    <Select
      value={value ?? "none"}
      onValueChange={(v) => onValueChange(v === "none" ? null : v)}
      disabled={disabled}
    >
      <SelectTrigger className="w-[160px] h-8 text-xs">
        <SelectValue placeholder="Tag…" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="none">— Clear —</SelectItem>
        {tags.map((t) => (
          <SelectItem key={t.value} value={t.value}>
            {t.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
