import { HelpCircle } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GLOSSARY, type GlossaryTerm } from "@/lib/glossary";
import { useBeginnerMode } from "@/hooks/use-beginner-mode";

interface Props {
  /** The glossary key to look up. */
  term: GlossaryTerm;
  /**
   * What to render as the visible label. Defaults to the term key
   * (lower-cased). Pass a string like "R:R" or any node when the
   * displayed text differs from the key.
   */
  children?: React.ReactNode;
  /**
   * "underline" (default) — wraps children with a dotted underline.
   * "icon" — appends a small "?" icon beside children.
   * "wrap" — children render unchanged; the entire trigger area is
   * just hover-sensitive (use when wrapping a label group, not text).
   */
  mode?: "underline" | "icon" | "wrap";
  className?: string;
}

/**
 * Phase 3 (improvement plan): one-stop glossary tooltip. The short
 * line previews on hover; in beginner mode the long-form description
 * is appended underneath so first-timers get the full context without
 * leaving the page.
 *
 * Tooltips are always available (advanced users benefit too); the
 * beginner-mode flag only changes how MUCH text is shown.
 */
export function TermTooltip({ term, children, mode = "underline", className }: Props) {
  const isBeginner = useBeginnerMode();
  const entry = GLOSSARY[term];
  const display = children ?? term;

  const trigger =
    mode === "icon" ? (
      <span className={className}>
        {display}
        <HelpCircle className="ml-1 inline h-3 w-3 align-[-1px] text-muted-foreground/70" />
      </span>
    ) : mode === "wrap" ? (
      <span className={className}>{display}</span>
    ) : (
      <span
        className={`underline decoration-dotted decoration-muted-foreground/40 underline-offset-2 cursor-help ${className ?? ""}`}
      >
        {display}
      </span>
    );

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>{trigger}</TooltipTrigger>
        <TooltipContent side="top" align="center" className="max-w-[280px] text-xs">
          <p className="font-medium">{entry.short}</p>
          {isBeginner && (
            <p className="mt-1.5 text-muted-foreground leading-relaxed">{entry.long}</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default TermTooltip;
