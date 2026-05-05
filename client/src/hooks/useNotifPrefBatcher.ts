import { useRef, useCallback, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type NotifPrefs = Partial<{
  planChanges: boolean;
  paymentFailures: boolean;
  trialExpiry: boolean;
  invitationAccepted: boolean;
  projectUpdates: boolean;
}>;

const NOTIF_LABELS: Record<string, string> = {
  planChanges: "Plan changes",
  paymentFailures: "Payment failures",
  trialExpiry: "Trial expiry warnings",
  invitationAccepted: "Invitation accepted",
  projectUpdates: "Project updates",
};

const DEBOUNCE_MS = 500;

export function useNotifPrefBatcher() {
  const { toast } = useToast();
  const pendingRef = useRef<NotifPrefs>({});
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutateRef = useRef<((prefs: NotifPrefs) => void) | null>(null);

  const mutation = useMutation({
    mutationFn: async (prefs: NotifPrefs) => {
      const res = await apiRequest("PATCH", "/api/user/notification-preferences", prefs);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notification-preferences"] });
      const keys = Object.keys(variables);
      if (keys.length === 1) {
        const key = keys[0];
        const enabled = (variables as Record<string, boolean>)[key];
        const label = NOTIF_LABELS[key] ?? key;
        toast({ title: `${label} notifications ${enabled ? "enabled" : "disabled"}`, duration: 3000 });
      } else {
        toast({ title: `${keys.length} preferences updated`, duration: 3000 });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update preferences", description: error.message, variant: "destructive" });
    },
  });

  mutateRef.current = mutation.mutate;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const handleChange = useCallback((key: keyof NotifPrefs, value: boolean) => {
    pendingRef.current = { ...pendingRef.current, [key]: value };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const prefs = pendingRef.current;
      pendingRef.current = {};
      mutateRef.current?.(prefs);
    }, DEBOUNCE_MS);
  }, []);

  return { handleChange, isPending: mutation.isPending };
}
