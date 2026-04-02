import RiskCalculator from "@/components/calculator/RiskCalculator";

export default function CalculatorPage() {
  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Position Size Calculator</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Calculate your safe position size based on account size, risk tolerance, and stop-loss distance.
        </p>
      </div>
      <RiskCalculator />
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-4">
        <h3 className="text-sm font-semibold text-foreground mb-2">💡 How it works</h3>
        <ul className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <li>• <strong>Risk Amount</strong> = Account Size × Risk %</li>
          <li>• <strong>SL Distance</strong> = |Entry Price − Stop Loss| in pips</li>
          <li>• <strong>Lot Size</strong> = Risk Amount ÷ (SL Distance × Pip Value)</li>
          <li>• Standard lot = 100,000 units. Pip value assumes USD-quoted pairs.</li>
        </ul>
      </div>
    </div>
  );
}
