// Phase 11: React Query wrappers for the analytics service.
//
// Pure plumbing — no business logic. The hooks just call into the query
// layer (`src/lib/analytics/queries.ts`) and pipe the result through
// `analyze()`. UI consumers (Phase 12) should depend only on these
// hooks; they should never reach into Supabase directly.

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  analyze,
  fetchBacktestSignalsWithOutcomes,
  fetchLiveSignalsWithOutcomes,
  fetchJournalOutcomes,
  type AnalyticsOutput,
  type LiveSignalFilters,
  type JournalOutcome,
} from "@/lib/analytics";
import { useAuth } from "@/contexts/AuthContext";

export function useBacktestAnalytics(runId: string | null | undefined) {
  return useQuery<AnalyticsOutput>({
    queryKey: ["analytics", "backtest", runId],
    enabled: !!runId,
    queryFn: async () => {
      const items = await fetchBacktestSignalsWithOutcomes(supabase, runId!);
      return analyze({ items });
    },
    staleTime: 60_000,
  });
}

export function useLiveSignalAnalytics(filters: LiveSignalFilters) {
  return useQuery<AnalyticsOutput>({
    queryKey: ["analytics", "live", filters],
    queryFn: async () => {
      const items = await fetchLiveSignalsWithOutcomes(supabase, filters);
      return analyze({ items });
    },
    staleTime: 60_000,
  });
}

export function useJournalAnalytics(range: { since: string; until?: string }) {
  const { user } = useAuth();
  return useQuery<JournalOutcome[]>({
    queryKey: ["analytics", "journal", user?.id, range],
    enabled: !!user?.id,
    queryFn: () => fetchJournalOutcomes(supabase, user!.id, range),
    staleTime: 60_000,
  });
}
