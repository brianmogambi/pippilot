import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useIsAdmin() {
  const { user } = useAuth();
  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
    staleTime: 5 * 60 * 1000,
  });
  return { isAdmin, isLoading };
}

export function useAdminSignals(filters?: {
  pair?: string;
  status?: string;
  setupType?: string;
  reviewTag?: string;
}) {
  return useQuery({
    queryKey: ["admin-signals", filters],
    queryFn: async () => {
      let q = supabase.from("signals").select("*").order("created_at", { ascending: false });
      if (filters?.pair) q = q.eq("pair", filters.pair);
      if (filters?.status) q = q.eq("status", filters.status);
      if (filters?.setupType) q = q.eq("setup_type", filters.setupType);
      if (filters?.reviewTag === "unreviewed") q = q.is("review_tag", null);
      else if (filters?.reviewTag) q = q.eq("review_tag", filters.reviewTag);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useAdminAlerts(filters?: {
  pair?: string;
  type?: string;
  severity?: string;
  reviewTag?: string;
}) {
  return useQuery({
    queryKey: ["admin-alerts", filters],
    queryFn: async () => {
      let q = supabase.from("alerts").select("*").order("created_at", { ascending: false });
      if (filters?.pair) q = q.eq("pair", filters.pair);
      if (filters?.type) q = q.eq("type", filters.type);
      if (filters?.severity) q = q.eq("severity", filters.severity);
      if (filters?.reviewTag === "unreviewed") q = q.is("review_tag", null);
      else if (filters?.reviewTag) q = q.eq("review_tag", filters.reviewTag);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useReviewSignal() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, review_tag, review_notes }: { id: string; review_tag: string | null; review_notes?: string }) => {
      const { error } = await supabase
        .from("signals")
        .update({
          review_tag,
          review_notes: review_notes ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-signals"] }),
  });
}

export function useReviewAlert() {
  const qc = useQueryClient();
  const { user } = useAuth();
  return useMutation({
    mutationFn: async ({ id, review_tag, review_notes }: { id: string; review_tag: string | null; review_notes?: string }) => {
      const { error } = await supabase
        .from("alerts")
        .update({
          review_tag,
          review_notes: review_notes ?? null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user?.id ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-alerts"] }),
  });
}

export function useSignalReviewStats(signals: any[]) {
  const total = signals.length;
  const reviewed = signals.filter((s) => s.review_tag).length;
  const good = signals.filter((s) => s.review_tag === "good_signal").length;
  const falsePositive = signals.filter((s) => s.review_tag === "false_positive").length;
  const needsReview = signals.filter((s) => s.review_tag === "needs_review").length;
  const avgConfGood = good > 0 ? Math.round(signals.filter((s) => s.review_tag === "good_signal").reduce((a, s) => a + s.confidence, 0) / good) : 0;
  const avgConfFP = falsePositive > 0 ? Math.round(signals.filter((s) => s.review_tag === "false_positive").reduce((a, s) => a + s.confidence, 0) / falsePositive) : 0;

  return {
    total,
    reviewed,
    reviewedPct: total > 0 ? Math.round((reviewed / total) * 100) : 0,
    good,
    falsePositive,
    needsReview,
    goodRate: reviewed > 0 ? Math.round((good / reviewed) * 100) : 0,
    avgConfGood,
    avgConfFP,
  };
}
