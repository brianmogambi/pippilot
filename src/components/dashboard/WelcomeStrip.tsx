import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Activity,
  Calculator,
  CheckCircle2,
  Circle,
  Eye,
  PencilLine,
  X,
} from "lucide-react";

const STORAGE_KEY = "pippilot.welcome.dismissed";
const DONE_KEY = "pippilot.welcome.done";

interface Step {
  id: "watch" | "review" | "size" | "journal";
  label: string;
  description: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

const STEPS: Step[] = [
  {
    id: "watch",
    label: "1. See the market",
    description: "Scan today's pairs and trends.",
    href: "/watchlist",
    icon: Eye,
  },
  {
    id: "review",
    label: "2. Review the top trade",
    description: "Read the setup and the risks.",
    href: "/signals",
    icon: Activity,
  },
  {
    id: "size",
    label: "3. Calculate lot size",
    description: "Convert risk % into a safe lot.",
    href: "/calculator",
    icon: Calculator,
  },
  {
    id: "journal",
    label: "4. Journal the result",
    description: "Capture lessons after the trade closes.",
    href: "/journal",
    icon: PencilLine,
  },
];

/**
 * Phase 4 (improvement plan): the "what to do today" strip. Renders
 * once per session above the account bar to give a first-time
 * beginner a clear 4-step path. Each click marks the step done so
 * the visual nudges next-steps. Dismiss button hides it for the
 * remainder of the session.
 */
export function WelcomeStrip() {
  const [dismissed, setDismissed] = useState(() =>
    typeof sessionStorage !== "undefined"
      ? sessionStorage.getItem(STORAGE_KEY) === "1"
      : false,
  );
  const [done, setDone] = useState<Set<Step["id"]>>(() => {
    if (typeof sessionStorage === "undefined") return new Set();
    const raw = sessionStorage.getItem(DONE_KEY);
    return new Set(raw ? (JSON.parse(raw) as Step["id"][]) : []);
  });

  useEffect(() => {
    if (typeof sessionStorage === "undefined") return;
    sessionStorage.setItem(DONE_KEY, JSON.stringify(Array.from(done)));
  }, [done]);

  if (dismissed) return null;

  const markDone = (id: Step["id"]) => {
    setDone((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleDismiss = () => {
    sessionStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  };

  return (
    <div className="rounded-lg border border-primary/20 bg-primary/[0.04] p-3 relative">
      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded hover:bg-primary/10 transition-colors"
        aria-label="Dismiss welcome strip"
      >
        <X className="h-3 w-3 text-muted-foreground" />
      </button>

      <p className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2">
        Today's flow
      </p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {STEPS.map((step) => {
          const Icon = step.icon;
          const isDone = done.has(step.id);
          return (
            <Link
              key={step.id}
              to={step.href}
              onClick={() => markDone(step.id)}
              className={`group rounded-md border px-2.5 py-2 transition-colors ${
                isDone
                  ? "border-bullish/30 bg-bullish/[0.06]"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              <div className="flex items-start gap-2">
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-bullish mt-0.5 shrink-0" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-muted-foreground/60 mt-0.5 shrink-0" />
                )}
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <Icon className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs font-medium text-foreground truncate">
                      {step.label}
                    </span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">
                    {step.description}
                  </p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export default WelcomeStrip;
