// Technical indicator calculations from OHLCV data.
// All arrays: index 0 = oldest, last index = most recent.

/** Simple Moving Average */
export function sma(data: number[], period: number): number[] {
  const result: number[] = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      result.push(NaN);
      continue;
    }
    let sum = 0;
    for (let j = i - period + 1; j <= i; j++) sum += data[j];
    result.push(sum / period);
  }
  return result;
}

/** Exponential Moving Average */
export function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1);
  const result: number[] = [];

  // Seed with SMA of first `period` values
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    if (i < period - 1) {
      sum += data[i];
      result.push(NaN);
      continue;
    }
    if (i === period - 1) {
      sum += data[i];
      result.push(sum / period);
      continue;
    }
    result.push(data[i] * k + result[i - 1] * (1 - k));
  }
  return result;
}

/** Relative Strength Index (Wilder's smoothing) */
export function rsi(closes: number[], period: number): number[] {
  const result: number[] = new Array(closes.length).fill(NaN);
  if (closes.length < period + 1) return result;

  // Calculate initial gains and losses
  let avgGain = 0;
  let avgLoss = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change > 0) avgGain += change;
    else avgLoss += Math.abs(change);
  }
  avgGain /= period;
  avgLoss /= period;

  result[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  // Wilder's smoothing for subsequent values
  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? Math.abs(change) : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    result[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return result;
}

/** Average True Range */
export function atr(
  highs: number[],
  lows: number[],
  closes: number[],
  period: number,
): number[] {
  const result: number[] = new Array(highs.length).fill(NaN);
  if (highs.length < 2) return result;

  // True Range
  const tr: number[] = [highs[0] - lows[0]];
  for (let i = 1; i < highs.length; i++) {
    tr.push(Math.max(
      highs[i] - lows[i],
      Math.abs(highs[i] - closes[i - 1]),
      Math.abs(lows[i] - closes[i - 1]),
    ));
  }

  // Initial ATR = SMA of first `period` TRs
  if (tr.length < period) return result;
  let atrVal = 0;
  for (let i = 0; i < period; i++) atrVal += tr[i];
  atrVal /= period;
  result[period - 1] = atrVal;

  // Wilder's smoothing
  for (let i = period; i < tr.length; i++) {
    atrVal = (atrVal * (period - 1) + tr[i]) / period;
    result[i] = atrVal;
  }
  return result;
}

/** MACD (Moving Average Convergence Divergence) */
export function macd(
  closes: number[],
  fastPeriod = 12,
  slowPeriod = 26,
  signalPeriod = 9,
): { macd: number[]; signal: number[]; histogram: number[] } {
  const fastEma = ema(closes, fastPeriod);
  const slowEma = ema(closes, slowPeriod);

  const macdLine: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(fastEma[i]) || isNaN(slowEma[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEma[i] - slowEma[i]);
    }
  }

  // Signal line = EMA of MACD line (only valid values)
  const validMacd = macdLine.filter((v) => !isNaN(v));
  const signalFromValid = ema(validMacd, signalPeriod);

  // Map back to full-length array
  const signalLine: number[] = new Array(closes.length).fill(NaN);
  let vi = 0;
  for (let i = 0; i < closes.length; i++) {
    if (!isNaN(macdLine[i])) {
      signalLine[i] = signalFromValid[vi++];
    }
  }

  const histogram: number[] = [];
  for (let i = 0; i < closes.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      histogram.push(NaN);
    } else {
      histogram.push(macdLine[i] - signalLine[i]);
    }
  }

  return { macd: macdLine, signal: signalLine, histogram };
}

/** Bollinger Bands */
export function bollingerBands(
  closes: number[],
  period = 20,
  stdDevMultiplier = 2,
): { upper: number[]; middle: number[]; lower: number[] } {
  const middle = sma(closes, period);
  const upper: number[] = [];
  const lower: number[] = [];

  for (let i = 0; i < closes.length; i++) {
    if (isNaN(middle[i])) {
      upper.push(NaN);
      lower.push(NaN);
      continue;
    }
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) {
      variance += (closes[j] - middle[i]) ** 2;
    }
    const stdDev = Math.sqrt(variance / period);
    upper.push(middle[i] + stdDevMultiplier * stdDev);
    lower.push(middle[i] - stdDevMultiplier * stdDev);
  }

  return { upper, middle, lower };
}

/** Get last valid (non-NaN) value from an array */
export function lastValid(arr: number[]): number {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (!isNaN(arr[i])) return arr[i];
  }
  return NaN;
}

/** Get last N valid values from an array */
export function lastNValid(arr: number[], n: number): number[] {
  const result: number[] = [];
  for (let i = arr.length - 1; i >= 0 && result.length < n; i--) {
    if (!isNaN(arr[i])) result.unshift(arr[i]);
  }
  return result;
}
