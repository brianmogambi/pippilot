import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";

interface Props {
  defaultEntry?: number;
  defaultSl?: number;
}

export default function RiskCalculator({ defaultEntry, defaultSl }: Props) {
  const [accountSize, setAccountSize] = useState(10000);
  const [riskPct, setRiskPct] = useState(1);
  const [entryPrice, setEntryPrice] = useState(defaultEntry ?? 0);
  const [stopLoss, setStopLoss] = useState(defaultSl ?? 0);

  const riskAmount = accountSize * (riskPct / 100);
  const slDistance = Math.abs(entryPrice - stopLoss);
  const pipValue = slDistance > 0 ? slDistance : 0;
  const lotSize = pipValue > 0 ? (riskAmount / (slDistance * 100000)).toFixed(2) : "—";

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calculator className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-foreground">Position Size Calculator</h3>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Account Size ($)</Label>
          <Input
            type="number"
            value={accountSize}
            onChange={(e) => setAccountSize(Number(e.target.value))}
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Risk %</Label>
          <Input
            type="number"
            value={riskPct}
            onChange={(e) => setRiskPct(Number(e.target.value))}
            step={0.5}
            min={0.1}
            max={10}
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Entry Price</Label>
          <Input
            type="number"
            value={entryPrice || ""}
            onChange={(e) => setEntryPrice(Number(e.target.value))}
            step={0.0001}
            className="bg-muted border-border"
          />
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Stop Loss</Label>
          <Input
            type="number"
            value={stopLoss || ""}
            onChange={(e) => setStopLoss(Number(e.target.value))}
            step={0.0001}
            className="bg-muted border-border"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 p-3 rounded-lg bg-muted">
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Risk Amount</p>
          <p className="text-lg font-bold text-foreground">${riskAmount.toFixed(2)}</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">SL Distance</p>
          <p className="text-lg font-bold text-foreground">{(slDistance * 10000).toFixed(1)} pips</p>
        </div>
        <div className="text-center">
          <p className="text-xs text-muted-foreground">Lot Size</p>
          <p className="text-lg font-bold text-primary">{lotSize}</p>
        </div>
      </div>
    </div>
  );
}
