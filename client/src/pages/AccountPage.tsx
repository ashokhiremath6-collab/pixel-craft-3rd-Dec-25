import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Bell, User } from "lucide-react";

export default function AccountPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();

  const { data: notificationPrefs } = useQuery<{
    planChanges: boolean;
    paymentFailures: boolean;
    trialExpiry: boolean;
    invitationAccepted: boolean;
    projectUpdates: boolean;
  }>({
    queryKey: ["/api/user/notification-preferences"],
    enabled: !!currentUser,
  });

  const updateNotifPrefMutation = useMutation({
    mutationFn: async (prefs: Partial<{ planChanges: boolean; paymentFailures: boolean; trialExpiry: boolean; invitationAccepted: boolean; projectUpdates: boolean }>) => {
      const res = await apiRequest("PATCH", "/api/user/notification-preferences", prefs);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user/notification-preferences"] });
      toast({ title: "Preferences saved", duration: 3000 });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update preferences", description: error.message, variant: "destructive" });
    },
  });

  const isAdmin = currentUser?.role === "admin";

  const notifItems = isAdmin
    ? [
        {
          key: "planChanges" as const,
          label: "Plan changes",
          description: "Emails when your workspace plan changes.",
        },
        {
          key: "paymentFailures" as const,
          label: "Payment failures",
          description: "Emails when a payment attempt fails.",
        },
        {
          key: "trialExpiry" as const,
          label: "Trial expiry",
          description: "Reminder emails as your free trial approaches its end date.",
        },
        {
          key: "invitationAccepted" as const,
          label: "Invitation accepted",
          description: "Emails when someone accepts a workspace invitation you sent.",
        },
        {
          key: "projectUpdates" as const,
          label: "Project updates",
          description: "Emails about changes and activity on projects you are assigned to.",
        },
      ]
    : [
        {
          key: "invitationAccepted" as const,
          label: "Invitation accepted",
          description: "Emails when someone accepts a workspace invitation you sent.",
        },
        {
          key: "projectUpdates" as const,
          label: "Project updates",
          description: "Emails about changes and activity on projects you are assigned to.",
        },
      ];

  if (authLoading) return null;

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2" data-testid="heading-account">
          <User className="h-6 w-6" />
          Account
        </h1>
        <p className="text-muted-foreground mt-1">Manage your personal account preferences.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which transactional emails you receive about your account and projects.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {notifItems.map(({ key, label, description }) => {
              const enabled = notificationPrefs ? notificationPrefs[key] : true;
              return (
                <div key={key} className="flex items-start gap-4">
                  <Checkbox
                    id={`notif-${key}`}
                    checked={enabled}
                    disabled={updateNotifPrefMutation.isPending}
                    onCheckedChange={(checked) => {
                      updateNotifPrefMutation.mutate({ [key]: !!checked });
                    }}
                    className="mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <label htmlFor={`notif-${key}`} className="text-sm font-medium cursor-pointer">
                      {label}
                    </label>
                    <p className="text-sm text-muted-foreground">{description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
