import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function useWatchlist() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_watchlist")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useDashboardWatchlist(limit = 6) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["dashboard-watchlist", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_watchlist").select("pair").limit(limit);
      return data ?? [];
    },
    enabled: !!user,
  });
}

export function useInstruments() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("symbol")
        .eq("is_active", true)
        .order("symbol");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });
}

export function useAddToWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pair: string) => {
      const { error } = await supabase.from("user_watchlist").insert({ user_id: user!.id, pair });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-watchlist"] });
      toast.success("Added to watchlist");
    },
    onError: () => toast.error("Failed to add"),
  });
}

export function useRemoveFromWatchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (pair: string) => {
      const { error } = await supabase.from("user_watchlist").delete().eq("user_id", user!.id).eq("pair", pair);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-watchlist"] });
      toast.success("Removed from watchlist");
    },
  });
}
