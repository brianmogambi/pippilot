import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// fetch-market-data hits Twelve Data for ~16 pairs sequentially; in practice
// it returns in 5–15s. The cap stops the button from spinning forever when
// the Edge Function cold-starts or rate-limits.
const REFRESH_TIMEOUT_MS = 30_000;

/**
 * Manually trigger the fetch-market-data Edge Function and invalidate
 * cached prices so the UI re-renders with fresh data.
 *
 * Complements `useAutoRefresh` (fires once per session when stale) and
 * the 1-minute polling on `useAllMarketData`.
 */
export function useRefreshMarketData() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const winner = await Promise.race([
        supabase.functions.invoke("fetch-market-data"),
        new Promise<{ data: null; error: Error }>((resolve) =>
          setTimeout(
            () => resolve({ data: null, error: new Error("Refresh timed out — try again in a moment") }),
            REFRESH_TIMEOUT_MS,
          ),
        ),
      ]);
      if (winner.error) throw winner.error;
      return winner.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["market-data-all"] });
      toast.success("Market data refreshed");
    },
    onError: (error: Error) => {
      toast.error(`Refresh failed: ${error.message}`);
    },
  });
}
