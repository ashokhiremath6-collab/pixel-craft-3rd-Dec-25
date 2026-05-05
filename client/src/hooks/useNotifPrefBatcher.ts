import { useRef, useCallback, useEffect, useState } from "react";
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
  const prevValuesRef = useRef<NotifPrefs>({});

  const [optimisticOverrides, setOptimisticOverrides] = useState<NotifPrefs>({});

  const mutation = useMutation({
    mutationFn: async (prefs: NotifPrefs) => {
      const res = await apiRequest("PATCH", "/api/user/notification-preferences", prefs);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notification-preferences"] });
      setOptimisticOverrides((prev) => {
        const next = { ...prev };
        for (const key of Object.keys(variables) as Array<keyof NotifPrefs>) {
          // Only clear the override if its current value still matches what
          // was sent. If the user toggled this key again after the request
          // was dispatched, the override will differ and must be kept.
          if (next[key] === variables[key]) {
            delete next[key];
          }
        }
        return next;
      });
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
    onError: (error: Error, variables) => {
      const snapshot = prevValuesRef.current;
      // Revert only the keys that belonged to this batch and whose override
      // still reflects the value we tried to save (i.e. the user has not
      // toggled them again since the request was sent).
      setOptimisticOverrides((prev) => {
        const next = { ...prev };
        for (const k of Object.keys(variables) as Array<keyof NotifPrefs>) {
          if (next[k] === variables[k]) {
            next[k] = snapshot[k];
          }
        }
        return next;
      });
      queryClient
        .invalidateQueries({ queryKey: ["/api/user/notification-preferences"] })
        .then(() => {
          setOptimisticOverrides((prev) => {
            const next = { ...prev };
            for (const k of Object.keys(snapshot) as Array<keyof NotifPrefs>) {
              // Only remove the rollback override if it still holds the
              // reverted value — the server query has now refreshed it.
              if (next[k] === snapshot[k]) {
                delete next[k];
              }
            }
            return next;
          });
        });
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
    setOptimisticOverrides((prev) => ({ ...prev, [key]: value }));
    pendingRef.current = { ...pendingRef.current, [key]: value };
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      const prefs = pendingRef.current;
      pendingRef.current = {};

      const cached =
        (queryClient.getQueryData<NotifPrefs>(["/api/user/notification-preferences"]) as NotifPrefs | undefined) ?? {};
      const snapshot: NotifPrefs = {};
      for (const k of Object.keys(prefs) as Array<keyof NotifPrefs>) {
        snapshot[k] = cached[k] ?? true;
      }
      prevValuesRef.current = snapshot;

      mutateRef.current?.(prefs);
    }, DEBOUNCE_MS);
  }, []);

  return { handleChange, optimisticOverrides };
}
