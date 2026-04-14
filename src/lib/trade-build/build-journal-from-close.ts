// Phase 18.9: pure helper that builds a trade_journal_entries insert
// payload from an executed trade + the close-dialog review form.
//
// Extracted out of CloseTradeReviewDialog so the "journal auto-
// prefill" contract can be unit-tested independently of React.
// This is the thing users actually see in their journal after a
// Close & Journal click — any drift here is a data quality bug.

import type {
  AccountMode,
  ExecutedTrade,
} from "@/types/trading";
import type { TradePnlOutput } from "@/lib/trade-pnl";

export interface CloseReviewInputs {
  followedPlan: boolean;
  lessonLearned: string;
  emotionBefore: string;
  emotionAfter: string;
  setupRating: number;
  executionRating: number;
  disciplineRating: number;
  mistakeTags: string[];
  screenshotBefore: string;
  screenshotAfter: string;
  closeNotes: string;
}

/**
 * Build the journal insert payload. The caller passes the trade as
 * it exists in the DB (so planned_* snapshot fields flow in
 * verbatim), the close-dialog review inputs, the already-computed
 * P&L, and the exact closed_at timestamp that will go on both the
 * executed_trades row and the linked journal row.
 *
 * Return type is intentionally Record<string, unknown> because
 * useCreateJournalEntry takes a loose payload at the hook boundary;
 * this helper doesn't need to fight the hook's type erasure.
 */
export function buildJournalFromClose(params: {
  trade: ExecutedTrade;
  review: CloseReviewInputs;
  actualExitPrice: number;
  closedAt: string;
  pnl: TradePnlOutput;
}): Record<string, unknown> {
  const { trade, review, actualExitPrice, closedAt, pnl } = params;

  return {
    executed_trade_id: trade.id,
    account_mode: trade.account_mode as AccountMode,
    pair: trade.symbol,
    direction: trade.direction,

    // Trade mechanics: actuals snapshot
    entry_price: Number(trade.actual_entry_price),
    exit_price: actualExitPrice,
    stop_loss:
      trade.actual_stop_loss != null ? Number(trade.actual_stop_loss) : null,
    take_profit:
      trade.actual_take_profit != null ? Number(trade.actual_take_profit) : null,
    lot_size: trade.lot_size != null ? Number(trade.lot_size) : null,

    // Derived result
    result_pips: Math.round(pnl.pips * 10) / 10,
    result_amount:
      pnl.pnlUsd != null ? Math.round(pnl.pnlUsd * 100) / 100 : null,
    status: "closed" as const,
    opened_at: trade.opened_at,
    closed_at: closedAt,

    // Planned snapshot lifted from executed_trades into the journal
    setup_type: trade.planned_setup_type ?? null,
    confidence: trade.planned_confidence ?? null,
    setup_reasoning: trade.planned_reasoning_snapshot ?? null,

    // Structured review fields (Phase 18.4)
    followed_plan: review.followedPlan,
    lesson_learned: review.lessonLearned || null,
    emotion_before: review.emotionBefore || null,
    emotion_after: review.emotionAfter || null,
    setup_rating: review.setupRating || null,
    execution_rating: review.executionRating || null,
    discipline_rating: review.disciplineRating || null,
    mistake_tags: review.mistakeTags,
    screenshot_before: review.screenshotBefore || null,
    screenshot_after: review.screenshotAfter || null,
    notes: review.closeNotes || null,
  };
}
