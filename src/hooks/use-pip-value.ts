import { useMemo } from "react";
import { useAllMarketData } from "@/hooks/use-market-data";
import { calculatePipValueUSD, getDefaultPipValueUSD } from "@/lib/pip-value";
import type { Freshness } from "@/lib/data-freshness";

function buildPricesMap(data: Record<string, { price: number }> | null | undefined): Record<string, number> | null {
  if (!data) return null;
  const prices: Record<string, number> = {};
  for (const [symbol, md] of Object.entries(data)) {
    prices[symbol] = md.price;
  }
  return prices;
}

export function usePipValue(pair: string): { pipValue: number; freshness: Freshness } {
  const { data: allData } = useAllMarketData();

  return useMemo(() => {
    const prices = buildPricesMap(allData);
    if (prices) {
      const value = calculatePipValueUSD(pair, prices);
      if (value !== null) {
        return { pipValue: Math.round(value * 100) / 100, freshness: "live" as const };
      }
    }
    return { pipValue: getDefaultPipValueUSD(pair), freshness: "fallback" as const };
  }, [allData, pair]);
}

export function usePipValues(): { getPipValue: (pair: string) => number; freshness: Freshness } {
  const { data: allData } = useAllMarketData();

  return useMemo(() => {
    const prices = buildPricesMap(allData);
    if (prices) {
      return {
        getPipValue: (pair: string) => {
          const value = calculatePipValueUSD(pair, prices);
          return value !== null ? Math.round(value * 100) / 100 : getDefaultPipValueUSD(pair);
        },
        freshness: "live" as const,
      };
    }
    return {
      getPipValue: getDefaultPipValueUSD,
      freshness: "fallback" as const,
    };
  }, [allData]);
}
