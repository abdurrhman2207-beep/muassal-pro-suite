import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { setDefaultCurrency } from "@/lib/format";

export function useStoreSettings() {
  const q = useQuery({
    queryKey: ["store-settings"],
    queryFn: async () => (await supabase.from("store_settings").select("*").limit(1).single()).data,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (q.data?.currency) setDefaultCurrency(q.data.currency);
  }, [q.data?.currency]);
  return q;
}

export function useCurrencies() {
  return useQuery({
    queryKey: ["currencies"],
    queryFn: async () => (await supabase.from("currencies").select("*").order("is_base", { ascending: false })).data ?? [],
    staleTime: 5 * 60_000,
  });
}