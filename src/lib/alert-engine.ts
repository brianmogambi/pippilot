// src/lib/alert-engine.ts
//
// Alert Engine v2 — pure rules module that classifies signal lifecycle
// state into AlertCandidate[]. Backend-safe: no React, no Supabase, no
// DOM/Node-only globals. The only allowed imports are pure helpers from
// ./pip-value and ./risk-engine, both of which are themselves pure.
//
// This module can be mirrored verbatim into supabase/functions/_shared/
// when the Edge Function runner needs the rules in a Deno context.

import { isJpyPair } from "./pip-value";
import {
  calculateOpenRiskUSD,
  RISK_THRESHOLDS,
  type OpenPosition,
} from "./risk-engine";

// ── Types ───────────────────────────────────────────────────────

export type AlertEventKind =
  | "setup_forming"
  | "entry_reached"
  | "confirmation_reached"
  | "tp1_reached"
  | "tp2_reached"
  | "tp3_reached"
  | "invalidation"
  | "risk_breach";

export type AlertSeverity = "info" | "warning" | "critical";

export const SEVERITY_BY_KIND: Record<AlertEventKind, AlertSeverity> = {
  setup_forming: "info",
  entry_reached: "info",
  confirmation_reached: "info",
  tp1_reached: "info",
  tp2_reached: "info",
  tp3_reached: "info",
  invalidation: "warning",
  risk_breach: "critical",
};

export interface SignalState {
  id: string;
  pair: string;
  direction: "long" | "short";
  status: string;
  verdict: "trade" | "no_trade" | null;
  setup_type: string | null;
  entry_price: number | null;
  stop_loss: number | null;
  take_profit_1: number | null;
  take_profit_2: number | null;
  take_profit_3: number | null;
  invalidation_reason: string | null;
}

export interface PriceState {
  pair: string;
  price: number;
  /** Optional ATR — when supplied, widens the entry-zone tolerance band. */
  atr?: number;
}

export interface PriorAlertSet {
  /** Set of event kinds already alerted (pending OR triggered) for this signal+user. */
  fired: ReadonlySet<AlertEventKind>;
}

export interface AlertCandidate {
  signal_id: string;
  pair: string;
  event_kind: AlertEventKind;
  severity: AlertSeverity;
  title: string;
  message: string;
  /** Stable hash: `${signal_id}:${event_kind}` — also enforced by DB unique index. */
  dedupe_key: string;
  analysis_run_id: string | null;
}

export interface RiskContext {
  balance: number;
  openPositions: readonly OpenPosition[];
  realizedLossUSD: number;
  maxDailyLossPct: number;
}

export type RiskBreachReason =
  | "open_risk_safety"
  | "open_risk_profile"
  | "daily_loss_profile";

// ── Helpers ─────────────────────────────────────────────────────

function dedupeKey(signalId: string, kind: AlertEventKind): string {
  return `${signalId}:${kind}`;
}

/** Tolerance for "price reached entry" — wider of 5 pips or 0.05 × ATR. */
function entryTolerance(pair: string, atr?: number): number {
  const fivePips = isJpyPair(pair) ? 0.05 : 0.0005; // 5 pips
  const atrBand = typeof atr === "number" && atr > 0 ? atr * 0.05 : 0;
  return Math.max(fivePips, atrBand);
}

function fmtPrice(pair: string, n: number): string {
  return n.toFixed(isJpyPair(pair) ? 3 : 5);
}

function dirLabel(d: "long" | "short"): string {
  return d.toUpperCase();
}

// ── Pure detectors ──────────────────────────────────────────────

export function detectSetupForming(signal: SignalState): boolean {
  return (
    signal.verdict === "trade" &&
    (signal.status === "active" || signal.status === "monitoring")
  );
}

export function detectEntryReached(
  signal: SignalState,
  price: PriceState,
): boolean {
  if (signal.entry_price == null || price.price <= 0) return false;
  const tol = entryTolerance(signal.pair, price.atr);
  return Math.abs(price.price - signal.entry_price) <= tol;
}

/** Status flip from monitoring → ready/triggered/confirmed. */
export function detectConfirmationReached(
  signal: SignalState,
  prior: SignalState | null,
): boolean {
  if (!prior) return false;
  const wasMonitoring =
    prior.status === "monitoring" || prior.status === "active";
  const nowConfirmed =
    signal.status === "ready" ||
    signal.status === "triggered" ||
    signal.status === "confirmed";
  return wasMonitoring && nowConfirmed;
}

export function detectTpReached(
  signal: SignalState,
  price: PriceState,
  level: 1 | 2 | 3,
): boolean {
  const tp =
    level === 1
      ? signal.take_profit_1
      : level === 2
        ? signal.take_profit_2
        : signal.take_profit_3;
  if (tp == null || price.price <= 0) return false;
  return signal.direction === "long" ? price.price >= tp : price.price <= tp;
}

export function detectInvalidation(
  signal: SignalState,
  price: PriceState,
): boolean {
  if (signal.invalidation_reason) return true;
  if (signal.stop_loss == null || price.price <= 0) return false;
  return signal.direction === "long"
    ? price.price <= signal.stop_loss
    : price.price >= signal.stop_loss;
}

export function detectRiskBreach(ctx: RiskContext): {
  breached: boolean;
  reason: RiskBreachReason | null;
} {
  if (ctx.balance <= 0) return { breached: false, reason: null };
  const openRiskUSD = calculateOpenRiskUSD(ctx.openPositions);
  const openRiskPct = (openRiskUSD / ctx.balance) * 100;
  const dailyLossPct = (ctx.realizedLossUSD / ctx.balance) * 100;

  if (openRiskPct > RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT) {
    return { breached: true, reason: "open_risk_safety" };
  }
  if (dailyLossPct > ctx.maxDailyLossPct) {
    return { breached: true, reason: "daily_loss_profile" };
  }
  if (openRiskPct > ctx.maxDailyLossPct) {
    return { breached: true, reason: "open_risk_profile" };
  }
  return { breached: false, reason: null };
}

// ── Formatters (pure) ───────────────────────────────────────────

function buildCandidate(
  signal: SignalState,
  kind: AlertEventKind,
  title: string,
  message: string,
  analysisRunId: string | null,
): AlertCandidate {
  return {
    signal_id: signal.id,
    pair: signal.pair,
    event_kind: kind,
    severity: SEVERITY_BY_KIND[kind],
    title,
    message,
    dedupe_key: dedupeKey(signal.id, kind),
    analysis_run_id: analysisRunId,
  };
}

function setupLabel(signal: SignalState): string {
  return signal.setup_type ?? "Setup";
}

// ── Single entry points ─────────────────────────────────────────

export function evaluateSignalAlerts(args: {
  signal: SignalState;
  priorSignal: SignalState | null;
  price: PriceState;
  prior: PriorAlertSet;
  analysisRunId: string | null;
}): AlertCandidate[] {
  const { signal, priorSignal, price, prior, analysisRunId } = args;
  const out: AlertCandidate[] = [];
  const has = (k: AlertEventKind) => prior.fired.has(k);

  if (!has("setup_forming") && detectSetupForming(signal)) {
    out.push(
      buildCandidate(
        signal,
        "setup_forming",
        `${setupLabel(signal)} forming on ${signal.pair}`,
        `${setupLabel(signal)} · ${dirLabel(signal.direction)} setup is forming on ${signal.pair}.`,
        analysisRunId,
      ),
    );
  }

  if (!has("entry_reached") && detectEntryReached(signal, price)) {
    out.push(
      buildCandidate(
        signal,
        "entry_reached",
        `${signal.pair} entry zone reached`,
        `${setupLabel(signal)} · ${dirLabel(signal.direction)} entry zone reached at ${fmtPrice(signal.pair, price.price)}.`,
        analysisRunId,
      ),
    );
  }

  if (
    !has("confirmation_reached") &&
    detectConfirmationReached(signal, priorSignal)
  ) {
    out.push(
      buildCandidate(
        signal,
        "confirmation_reached",
        `${signal.pair} setup confirmed`,
        `${setupLabel(signal)} · ${dirLabel(signal.direction)} setup is now confirmed on ${signal.pair}.`,
        analysisRunId,
      ),
    );
  }

  for (const level of [1, 2, 3] as const) {
    const kind: AlertEventKind = `tp${level}_reached` as AlertEventKind;
    if (!has(kind) && detectTpReached(signal, price, level)) {
      const tp =
        level === 1
          ? signal.take_profit_1!
          : level === 2
            ? signal.take_profit_2!
            : signal.take_profit_3!;
      out.push(
        buildCandidate(
          signal,
          kind,
          `${signal.pair} TP${level} hit`,
          `${setupLabel(signal)} · ${dirLabel(signal.direction)} TP${level} reached at ${fmtPrice(signal.pair, tp)}.`,
          analysisRunId,
        ),
      );
    }
  }

  if (!has("invalidation") && detectInvalidation(signal, price)) {
    const reason =
      signal.invalidation_reason ??
      `price crossed stop-loss at ${fmtPrice(signal.pair, signal.stop_loss ?? 0)}`;
    out.push(
      buildCandidate(
        signal,
        "invalidation",
        `${signal.pair} setup invalidated`,
        `${setupLabel(signal)} · ${dirLabel(signal.direction)} invalidated — ${reason}.`,
        analysisRunId,
      ),
    );
  }

  return out;
}

const RISK_BREACH_MESSAGE: Record<RiskBreachReason, string> = {
  open_risk_safety: `Total open risk exceeds the ${RISK_THRESHOLDS.TOTAL_OPEN_RISK_SAFETY_PCT}% safety threshold.`,
  open_risk_profile: "Total open risk exceeds your daily-loss profile cap.",
  daily_loss_profile: "Daily realized loss exceeds your profile cap.",
};

export function evaluateRiskAlert(args: {
  ctx: RiskContext;
  prior: PriorAlertSet;
  signalIdForBreach: string;
  pair: string;
  analysisRunId?: string | null;
}): AlertCandidate | null {
  const { ctx, prior, signalIdForBreach, pair, analysisRunId = null } = args;
  if (prior.fired.has("risk_breach")) return null;
  const result = detectRiskBreach(ctx);
  if (!result.breached || !result.reason) return null;
  return {
    signal_id: signalIdForBreach,
    pair,
    event_kind: "risk_breach",
    severity: SEVERITY_BY_KIND.risk_breach,
    title: "Risk threshold breached",
    message: RISK_BREACH_MESSAGE[result.reason],
    dedupe_key: dedupeKey(signalIdForBreach, "risk_breach"),
    analysis_run_id: analysisRunId,
  };
}

export function dedupeAlerts(
  candidates: readonly AlertCandidate[],
  existingDedupeKeys: ReadonlySet<string>,
): AlertCandidate[] {
  const seen = new Set<string>();
  const out: AlertCandidate[] = [];
  for (const c of candidates) {
    if (existingDedupeKeys.has(c.dedupe_key)) continue;
    if (seen.has(c.dedupe_key)) continue;
    seen.add(c.dedupe_key);
    out.push(c);
  }
  return out;
}
