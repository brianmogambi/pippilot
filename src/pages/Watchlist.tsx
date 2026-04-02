import { useState } from "react";
import { Eye, Plus, Trash2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";

export default function Watchlist() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [newPair, setNewPair] = useState("");

  const { data: instruments = [] } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("instruments").select("symbol").eq("is_active", true).order("symbol");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: watchlist = [], isLoading } = useQuery({
    queryKey: ["watchlist", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_watchlist").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const addMutation = useMutation({
    mutationFn: async (pair: string) => {
      const { error } = await supabase.from("user_watchlist").insert({ user_id: user!.id, pair });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      setNewPair("");
      toast.success("Pair added to watchlist");
    },
    onError: () => toast.error("Failed to add pair"),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("user_watchlist").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["watchlist"] });
      toast.success("Pair removed");
    },
  });

  const existingPairs = new Set(watchlist.map((w) => w.pair));
  const availablePairs = instruments.filter((i) => !existingPairs.has(i.symbol));

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Watchlist</h1>
          <p className="text-sm text-muted-foreground mt-1">Track your favorite currency pairs</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={newPair} onValueChange={setNewPair}>
            <SelectTrigger className="w-36 h-9 text-sm"><SelectValue placeholder="Select pair…" /></SelectTrigger>
            <SelectContent>
              {availablePairs.map((i) => <SelectItem key={i.symbol} value={i.symbol}>{i.symbol}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" className="gap-1" disabled={!newPair || addMutation.isPending} onClick={() => addMutation.mutate(newPair)}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {isLoading ? (
          <div className="p-6 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : watchlist.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            <Eye className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">Your watchlist is empty. Add pairs to start tracking.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Pair</TableHead>
                <TableHead>Added</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {watchlist.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium text-foreground flex items-center gap-2">
                    <Eye className="h-3.5 w-3.5 text-primary" />
                    {item.pair}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{new Date(item.created_at).toLocaleDateString()}</TableCell>
                  <TableCell>
                    <button
                      onClick={() => removeMutation.mutate(item.id)}
                      className="p-1 rounded hover:bg-accent transition-colors"
                    >
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-bearish" />
                    </button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground text-center">
        ⚠️ Prices are indicative only. Not financial advice. Trading carries risk.
      </p>
    </div>
  );
}
