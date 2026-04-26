import { useSearchParams } from "react-router-dom";
import RiskCalculator from "@/components/calculator/RiskCalculator";
import { BookOpen, ShieldCheck, TrendingDown } from "lucide-react";

const LOSS_RISKS = [1, 2, 5];
const LOSS_ROWS = 10;

function consecutiveLossTable() {
  const rows: { n: number; values: number[] }[] = [];
  for (let i = 1; i <= LOSS_ROWS; i++) {
    rows.push({
      n: i,
      values: LOSS_RISKS.map((r) => +(100 * Math.pow(1 - r / 100, i)).toFixed(2)),
    });
  }
  return rows;
}

const lossRows = consecutiveLossTable();

export default function CalculatorPage() {
  // Phase 4 (improvement plan): pre-fill the calculator from query
  // params so the "Calculate lot size" CTA on a signal card jumps
  // straight into a relevant calculation.
  const [params] = useSearchParams();
  const defaultPair = params.get("pair") ?? undefined;
  const entryParam = Number(params.get("entry"));
  const slParam = Number(params.get("sl"));
  const defaultEntry = Number.isFinite(entryParam) && entryParam > 0 ? entryParam : undefined;
  const defaultSl = Number.isFinite(slParam) && slParam > 0 ? slParam : undefined;

  return (
    <div className="p-4 md:p-6 lg:p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">Position Size Calculator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculate your safe position size based on account size, risk tolerance, and stop-loss distance.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6 items-start">
        {/* Left — Calculator */}
        <RiskCalculator defaultPair={defaultPair} defaultEntry={defaultEntry} defaultSl={defaultSl} />

        {/* Right — Educational panels */}
        <div className="space-y-5">
          {/* How Risk is Calculated */}
          <EducationCard icon={<BookOpen className="h-4 w-4 text-primary" />} title="How Risk is Calculated">
            <ol className="list-decimal list-inside space-y-1.5 text-xs text-muted-foreground leading-relaxed">
              <li><strong>Risk Amount</strong> = Account Balance × Risk %</li>
              <li><strong>SL Distance</strong> = |Entry Price − Stop Loss| converted to pips</li>
              <li><strong>Pip Value</strong> — calculated from live exchange rates per pair</li>
              <li><strong>Lot Size</strong> = Risk Amount ÷ (SL Distance × Pip Value)</li>
              <li><strong>Exposure</strong> = Lot Size × 100,000 units</li>
            </ol>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              * Pip values use live exchange rates when available, with static estimates as fallback.
            </p>
          </EducationCard>

          {/* Why Smaller Risk */}
          <EducationCard icon={<ShieldCheck className="h-4 w-4 text-bullish" />} title="Why Smaller Risk Protects You">
            <p className="text-xs text-muted-foreground leading-relaxed">
              A trader risking <strong>1% per trade</strong> can survive 20+ consecutive losses and still have over 80% of their account.
              At <strong>5% risk</strong>, just 10 losses wipes 40%.
            </p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-2">
              Smaller risk isn't about making less — it's about <strong>staying in the game long enough</strong> for your edge to compound.
              Professional traders almost never exceed 2%.
            </p>
          </EducationCard>

          {/* Consecutive Losses */}
          <EducationCard icon={<TrendingDown className="h-4 w-4 text-bearish" />} title="Impact of Consecutive Losses">
            <p className="text-xs text-muted-foreground mb-2">
              % of account remaining after N consecutive losing trades:
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-1 pr-2 text-muted-foreground font-medium">Losses</th>
                    {LOSS_RISKS.map((r) => (
                      <th key={r} className="text-right py-1 px-2 text-muted-foreground font-medium">{r}% risk</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lossRows.map((row) => (
                    <tr key={row.n} className="border-b border-border/50">
                      <td className="py-1 pr-2 font-mono text-foreground">{row.n}</td>
                      {row.values.map((v, i) => (
                        <td
                          key={i}
                          className={`text-right py-1 px-2 font-mono ${
                            v < 80 ? "text-bearish" : v < 95 ? "text-warning" : "text-foreground"
                          }`}
                        >
                          {v.toFixed(1)}%
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[10px] text-muted-foreground/70 mt-2">
              Even the best strategies face losing streaks. Size your positions so the math works in your favor.
            </p>
          </EducationCard>
        </div>
      </div>
    </div>
  );
}

function EducationCard({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
      </div>
      {children}
    </div>
  );
}
