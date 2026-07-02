import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Bell, User } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useEffect } from "react";
import { useNotifPrefBatcher } from "@/hooks/useNotifPrefBatcher";

const profileSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(100),
  lastName: z.string().max(100).optional().or(z.literal("")),
  notificationEmail: z.string().email("Please enter a valid email address").optional().or(z.literal("")),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

export default function AccountPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();

  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      notificationEmail: "",
    },
  });

  useEffect(() => {
    if (currentUser) {
      profileForm.reset({
        firstName: currentUser.firstName ?? "",
        lastName: currentUser.lastName ?? "",
        notificationEmail: (currentUser as any).notificationEmail ?? "",
      });
    }
  }, [currentUser?.firstName, currentUser?.lastName]);

  const updateProfileMutation = useMutation({
    mutationFn: async (values: ProfileFormValues) => {
      const payload = {
        ...values,
        notificationEmail: values.notificationEmail?.trim() || null,
      };
      const res = await apiRequest("PATCH", "/api/user/profile", payload);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Profile updated", duration: 3000 });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update profile", description: error.message, variant: "destructive" });
    },
  });

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

  const { handleChange: handleNotifChange, optimisticOverrides } = useNotifPrefBatcher();

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
            <User className="h-5 w-5" />
            Profile
          </CardTitle>
          <CardDescription>
            Update your display name and personal details.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              onSubmit={profileForm.handleSubmit((values) => updateProfileMutation.mutate(values))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={profileForm.control}
                  name="firstName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>First name</FormLabel>
                      <FormControl>
                        <Input placeholder="First name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={profileForm.control}
                  name="lastName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Last name</FormLabel>
                      <FormControl>
                        <Input placeholder="Last name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div>
                <FormLabel className="text-muted-foreground text-sm">Login email</FormLabel>
                <p className="text-sm mt-1">{currentUser?.email}</p>
              </div>
              <FormField
                control={profileForm.control}
                name="notificationEmail"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Correspondence email <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. yourname@gmail.com" {...field} />
                    </FormControl>
                    <p className="text-xs text-muted-foreground">System emails (project updates, invitations, billing) will be sent here instead of your login email. Leave blank to use your login email.</p>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={updateProfileMutation.isPending}>
                {updateProfileMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

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
              const serverValue = notificationPrefs ? notificationPrefs[key] : true;
              const enabled = key in optimisticOverrides ? optimisticOverrides[key] : serverValue;
              return (
                <div key={key} className="flex items-start gap-4">
                  <Checkbox
                    id={`notif-${key}`}
                    checked={enabled}
                    onCheckedChange={(checked) => {
                      handleNotifChange(key, !!checked);
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
