import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { Alert } from "@/types/trading";
import { toast } from "sonner";

export function useAlerts() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Alert[];
    },
    enabled: !!user,
  });
}

export function useDashboardAlerts(limit = 5) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-alerts", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("alerts")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(limit);
      return (data ?? []) as Alert[];
    },
    enabled: !!user,
  });
}

export function useUnreadAlertCount() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["unread-alerts", user?.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("alerts")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      return count ?? 0;
    },
    enabled: !!user,
  });
}

export function useMarkAlertRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from("alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
    },
  });
}

export function useMarkAllAlertsRead() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("alerts")
        .update({ is_read: true })
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      queryClient.invalidateQueries({ queryKey: ["unread-alerts"] });
      toast.success("All alerts marked as read");
    },
  });
}
