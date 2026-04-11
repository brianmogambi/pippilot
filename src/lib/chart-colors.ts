// src/lib/chart-colors.ts
// Single source of truth for chart colors, derived from the app's CSS variables.
// The app is dark-mode only — see src/index.css :root definitions.

export const CHART_COLORS = {
  // ── Layout ────────────────────────────────────────────────────
  background: "hsl(222, 47%, 9%)",       // --card
  text: "hsl(215, 20%, 55%)",            // --muted-foreground
  grid: "hsl(215, 25%, 14%)",            // --muted
  crosshair: "hsl(215, 20%, 55%)",       // --muted-foreground
  border: "hsl(215, 25%, 18%)",          // --border

  // ── Candles ───────────────────────────────────────────────────
  bullish: "hsl(142, 71%, 45%)",         // --bullish / --success
  bearish: "hsl(0, 84%, 60%)",           // --bearish / --destructive

  // ── EMA lines ─────────────────────────────────────────────────
  ema20: "#facc15",                       // yellow-400
  ema50: "#f97316",                       // orange-500
  ema200: "#a855f7",                      // purple-500

  // ── Trade levels ──────────────────────────────────────────────
  entryLine: "#3b82f6",                   // blue-500
  stopLoss: "#ef4444",                    // red-500
  takeProfit: "#22c55e",                  // green-500

  // ── Support / Resistance ──────────────────────────────────────
  support: "rgba(34, 197, 94, 0.5)",      // green, semi-transparent
  resistance: "rgba(239, 68, 68, 0.5)",   // red, semi-transparent
} as const;
