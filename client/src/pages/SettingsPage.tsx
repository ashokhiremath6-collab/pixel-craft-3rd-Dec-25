import { useState, useEffect } from "react";
import { useNotifPrefBatcher } from "@/hooks/useNotifPrefBatcher";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useLocation } from "wouter";
import { Settings, UserCog, Shield, Eye, Briefcase, Link2, Copy, Check, Mail, UserPlus, Trash2, RefreshCw, Clock, CreditCard, Zap, AlertTriangle, ExternalLink, BarChart3, Bell, Building2, Lock, Users } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { PlanLimitBanner } from "@/components/PlanLimitBanner";
import type { User, Project, UserProjectAssignment, Vendor } from "@shared/schema";

const UNLIMITED = 999_999;

function NonAdminRedirect() {
  const [, navigate] = useLocation();
  useEffect(() => {
    navigate("/account");
  }, [navigate]);
  return null;
}

interface BillingStatus {
  plan: string;
  planStatus: string;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

type UserWithRole = User & {
  role: string | null;
  roleIsActive: boolean;
  linkedVendorId: string | null;
};

interface Invitation {
  id: string;
  email: string;
  role: string;
  acceptedAt: string | null;
  expiresAt: string;
  createdAt: string;
  inviteUrl?: string;
}

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "designer", "project_manager", "client", "vendor"]),
  linkedVendorId: z.string().optional(),
});
type InviteValues = z.infer<typeof inviteSchema>;

export default function SettingsPage() {
  const { toast } = useToast();
  const { user: currentUser, isLoading: authLoading } = useAuth();
  const [, navigate] = useLocation();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");
  const [copiedUserId, setCopiedUserId] = useState<string | null>(null);
  const [showUserLimitDialog, setShowUserLimitDialog] = useState(false);

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "designer" },
  });

  const isAdmin = !authLoading && currentUser?.role === "admin";

  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["/api/users"],
    enabled: isAdmin,
  });

  const { data: projects, isLoading: projectsLoading, isError: projectsError } = useQuery<Project[]>({
    queryKey: ["/api/projects/all"],
    enabled: isAdmin,
  });

  const { data: allAssignments, isLoading: assignmentsLoading, isError: assignmentsError } = useQuery<UserProjectAssignment[]>({
    queryKey: ["/api/user-project-assignments"],
    enabled: isAdmin,
  });

  const { data: invitations, isLoading: invitationsLoading } = useQuery<Invitation[]>({
    queryKey: ["/api/invitations"],
    enabled: isAdmin && !!currentUser?.orgId,
  });

  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    enabled: isAdmin && !!currentUser?.orgId,
  });

  const { data: usageData } = useQuery<{
    plan: string;
    limits: { maxProjects: number; maxUsers: number; maxCatalogueItems: number; maxStorageGb: number };
    usage: { projects: number; users: number; catalogueItems: number; storageGb: number };
  }>({
    queryKey: ["/api/billing/usage"],
    enabled: isAdmin && !!currentUser?.orgId,
  });

  const { data: vendors } = useQuery<Vendor[]>({
    queryKey: ["/api/vendors"],
    enabled: isAdmin,
  });

  const { data: orgData } = useQuery<{ id: string; name: string; logoUrl?: string | null }>({
    queryKey: ["/api/organisations", currentUser?.orgId],
    queryFn: () => fetch(`/api/organisations/${currentUser?.orgId}`).then(r => r.json()),
    enabled: isAdmin && !!currentUser?.orgId,
  });

  const [editingOrgName, setEditingOrgName] = useState(false);
  const [orgNameInput, setOrgNameInput] = useState("");
  const [logoUploading, setLogoUploading] = useState(false);

  const updateOrgNameMutation = useMutation({
    mutationFn: async (name: string) => {
      return apiRequest("PATCH", `/api/organisations/${currentUser?.orgId}`, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/organisations", currentUser?.orgId] });
      setEditingOrgName(false);
      toast({ title: "Studio name updated" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update studio name", description: error.message, variant: "destructive" });
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

  const checkoutMutation = useMutation({
    mutationFn: async (plan: string) => {
      const res = await apiRequest("POST", "/api/billing/checkout", { plan });
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({ title: "Checkout error", description: error.message, variant: "destructive" });
    },
  });

  const portalMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/billing/portal", {});
      return res.json();
    },
    onSuccess: (data: { url: string }) => {
      if (data.url) window.location.href = data.url;
    },
    onError: (error: Error) => {
      toast({ title: "Portal error", description: error.message, variant: "destructive" });
    },
  });

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("POST", "/api/auth/role", { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Role updated", description: "User role has been successfully updated." });
      setEditingUserId(null);
      setSelectedRole("");
    },
    onError: (error: Error) => {
      toast({ title: "Error updating role", description: error.message || "Failed to update user role", variant: "destructive" });
    },
  });

  const assignProjectMutation = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      return apiRequest("POST", "/api/user-project-assignments", { userId, projectId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-project-assignments"] });
      toast({ title: "Project assigned", description: "Project has been assigned to user successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error assigning project", description: error.message || "Failed to assign project", variant: "destructive" });
    },
  });

  const unassignProjectMutation = useMutation({
    mutationFn: async ({ userId, projectId }: { userId: string; projectId: string }) => {
      return apiRequest("DELETE", `/api/user-project-assignments/${userId}/${projectId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-project-assignments"] });
      toast({ title: "Project unassigned", description: "Project has been removed from user successfully." });
    },
    onError: (error: Error) => {
      toast({ title: "Error unassigning project", description: error.message || "Failed to unassign project", variant: "destructive" });
    },
  });

  const [confirmRemoveUserId, setConfirmRemoveUserId] = useState<string | null>(null);

  const removeUserMutation = useMutation({
    mutationFn: async (userId: string) => {
      return apiRequest("DELETE", `/api/users/${userId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/usage"] });
      setConfirmRemoveUserId(null);
      toast({ title: "User removed", description: "The user has been removed from your organisation." });
    },
    onError: (error: Error) => {
      toast({ title: "Could not remove user", description: error.message || "Failed to remove user", variant: "destructive" });
    },
  });

  const resetLinkMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/reset-link`);
      return res.json();
    },
    onSuccess: async (data: any, userId: string) => {
      try {
        await navigator.clipboard.writeText(data.resetUrl);
        setCopiedUserId(userId);
        setTimeout(() => setCopiedUserId(null), 3000);
        toast({
          title: "Login link copied",
          description: `Reset link for ${data.email} copied to clipboard. Send it via WhatsApp or email — valid for 24 hours.`,
        });
      } catch {
        toast({ title: "Login link generated", description: data.resetUrl });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to generate link", description: error.message, variant: "destructive" });
    },
  });

  const [copiedInviteId, setCopiedInviteId] = useState<string | null>(null);

  const copyInviteLink = async (url: string, id: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedInviteId(id);
      setTimeout(() => setCopiedInviteId(null), 3000);
      toast({ title: "Invite link copied", description: "Share this link via WhatsApp or email." });
    } catch {
      toast({ title: "Invite link", description: url });
    }
  };

  const sendInviteMutation = useMutation({
    mutationFn: async (values: InviteValues) => {
      const res = await apiRequest("POST", "/api/invitations", values);
      return res.json();
    },
    onSuccess: (data: any) => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing/usage"] });
      inviteForm.reset();
      if (!data.emailSent && data.inviteUrl) {
        toast({
          title: "Invitation created — email not sent",
          description: "Email delivery failed. Copy the invite link and share it manually.",
          variant: "destructive",
        });
        copyInviteLink(data.inviteUrl, data.id);
      } else {
        toast({ title: "Invitation sent", description: "An invitation email has been sent." });
      }
    },
    onError: (error: Error) => {
      toast({ title: "Failed to send invitation", description: error.message, variant: "destructive" });
    },
  });

  const linkVendorMutation = useMutation({
    mutationFn: async ({ userId, linkedVendorId }: { userId: string; linkedVendorId: string | null }) => {
      return apiRequest("PATCH", `/api/users/${userId}/link-vendor`, { linkedVendorId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "Vendor linked", description: "The vendor account has been linked." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to link vendor", description: error.message, variant: "destructive" });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      return apiRequest("DELETE", `/api/invitations/${inviteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation revoked" });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to revoke invitation", description: error.message, variant: "destructive" });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      return apiRequest("POST", `/api/invitations/${inviteId}/resend`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({ title: "Invitation resent", description: "A fresh invitation link has been sent." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to resend invitation", description: error.message, variant: "destructive" });
    },
  });

  const handleSaveRole = (userId: string) => {
    if (!selectedRole) {
      toast({ title: "No role selected", description: "Please select a role before saving", variant: "destructive" });
      return;
    }
    updateRoleMutation.mutate({ userId, role: selectedRole });
  };

  const getRoleBadgeVariant = (role: string | null) => {
    if (!role) return "secondary" as const;
    switch (role) {
      case "admin": return "default" as const;
      case "designer": return "default" as const;
      case "project_manager": return "default" as const;
      case "client": return "secondary" as const;
      case "vendor": return "secondary" as const;
      default: return "secondary" as const;
    }
  };

  const getRoleIcon = (role: string | null) => {
    if (!role) return <Eye className="h-3 w-3" />;
    switch (role) {
      case "admin": return <Shield className="h-3 w-3" />;
      case "designer": return <UserCog className="h-3 w-3" />;
      case "project_manager": return <UserCog className="h-3 w-3" />;
      case "client": return <Eye className="h-3 w-3" />;
      case "vendor": return <Building2 className="h-3 w-3" />;
      default: return <Eye className="h-3 w-3" />;
    }
  };

  const isUserAssignedToProject = (userId: string, projectId: string) =>
    allAssignments?.some(a => a.userId === userId && a.projectId === projectId) || false;

  const handleToggleProjectAssignment = (userId: string, projectId: string, isAssigned: boolean) => {
    if (isAssigned) {
      unassignProjectMutation.mutate({ userId, projectId });
    } else {
      assignProjectMutation.mutate({ userId, projectId });
    }
  };

  const assignableUsers = users?.filter(u => ['project_manager', 'designer', 'architect'].includes(u.role ?? '')) || [];
  const pendingInvitations = invitations?.filter(i => !i.acceptedAt) || [];

  const isExpired = (expiresAt: string) => new Date(expiresAt) < new Date();

  // Wait for auth state to resolve before showing an access denied message
  // so there is no flash for users who do have access.
  if (authLoading) return null;

  // Non-admin users are redirected to the dedicated Account page which hosts
  // personal preferences including notifications.
  if (!authLoading && currentUser?.role !== "admin") {
    return <NonAdminRedirect />;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
          <p className="text-muted-foreground">Manage users and system preferences</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground">Manage users and system preferences</p>
      </div>

      {/* Studio name */}
      {isAdmin && currentUser?.orgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Studio Name
            </CardTitle>
            <CardDescription>The name shown to vendors and team members across the platform.</CardDescription>
          </CardHeader>
          <CardContent>
            {editingOrgName ? (
              <div className="flex items-center gap-2">
                <Input
                  value={orgNameInput}
                  onChange={e => setOrgNameInput(e.target.value)}
                  className="max-w-sm"
                  autoFocus
                  onKeyDown={e => {
                    if (e.key === "Enter") updateOrgNameMutation.mutate(orgNameInput);
                    if (e.key === "Escape") setEditingOrgName(false);
                  }}
                />
                <Button
                  onClick={() => updateOrgNameMutation.mutate(orgNameInput)}
                  disabled={updateOrgNameMutation.isPending || !orgNameInput.trim()}
                >
                  {updateOrgNameMutation.isPending ? "Saving…" : "Save"}
                </Button>
                <Button variant="outline" onClick={() => setEditingOrgName(false)}>Cancel</Button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="text-base font-medium">{orgData?.name ?? "—"}</span>
                <Button variant="outline" size="sm" onClick={() => { setOrgNameInput(orgData?.name ?? ""); setEditingOrgName(true); }}>
                  Rename
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Studio Logo */}
      {isAdmin && currentUser?.orgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Studio Logo
            </CardTitle>
            <CardDescription>Upload your studio logo — shown in the sidebar, dashboard, and vendor/client portals.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 flex-wrap">
              {orgData?.logoUrl ? (
                <img
                  src={`/api/organisations/${currentUser.orgId}/logo`}
                  alt="Studio logo"
                  className="h-16 rounded-md border object-contain bg-white"
                  style={{ maxWidth: 200 }}
                />
              ) : (
                <div className="h-16 w-16 rounded-md bg-muted flex items-center justify-center text-muted-foreground font-bold text-2xl border">
                  {(orgData?.name || "S").charAt(0).toUpperCase()}
                </div>
              )}
              <div className="flex flex-col gap-2">
                <label htmlFor="logo-upload">
                  <Button
                    variant="outline"
                    disabled={logoUploading}
                    onClick={() => document.getElementById("logo-upload")?.click()}
                  >
                    {logoUploading ? "Uploading…" : orgData?.logoUrl ? "Replace Logo" : "Upload Logo"}
                  </Button>
                </label>
                <p className="text-xs text-muted-foreground">PNG, JPG or SVG · max 5 MB</p>
                <input
                  id="logo-upload"
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    setLogoUploading(true);
                    try {
                      const fd = new FormData();
                      fd.append("logo", file);
                      const res = await fetch(`/api/organisations/${currentUser.orgId}/logo`, {
                        method: "POST",
                        body: fd,
                        credentials: "include",
                      });
                      if (!res.ok) throw new Error(await res.text());
                      queryClient.invalidateQueries({ queryKey: ["/api/organisations", currentUser.orgId] });
                      toast({ title: "Logo updated successfully" });
                    } catch (err: any) {
                      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
                    } finally {
                      setLogoUploading(false);
                      e.target.value = "";
                    }
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billing — hidden until payment is configured */}
      {false && currentUser?.role === "admin" && currentUser?.orgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Billing &amp; Subscription
            </CardTitle>
            <CardDescription>
              Manage your plan, view your subscription status, and update payment details.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {billingStatus ? (
              <>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Current plan:</span>
                    <Badge variant="default" className="capitalize">{billingStatus.plan}</Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    <Badge
                      variant={
                        billingStatus.planStatus === 'active' ? 'default' :
                        billingStatus.planStatus === 'past_due' ? 'destructive' :
                        'secondary'
                      }
                      className="capitalize"
                    >
                      {billingStatus.planStatus === 'trialing' ? 'Free trial' : billingStatus.planStatus.replace('_', ' ')}
                    </Badge>
                  </div>
                  {billingStatus.currentPeriodEnd && (
                    <span className="text-sm text-muted-foreground">
                      {billingStatus.planStatus === 'trialing' ? 'Trial ends' : 'Renews'}:{' '}
                      {new Date(billingStatus.currentPeriodEnd).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {/* Usage section */}
                {usageData && (
                  <div className="space-y-3 rounded-md border p-4 bg-muted/30">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-muted-foreground" />
                      <p className="text-sm font-medium">Usage</p>
                    </div>
                    {[
                      { label: 'Projects', current: usageData.usage.projects, limit: usageData.limits.maxProjects },
                      { label: 'Team members (incl. pending invites)', current: usageData.usage.users, limit: usageData.limits.maxUsers },
                      { label: 'Catalogue items', current: usageData.usage.catalogueItems, limit: usageData.limits.maxCatalogueItems },
                      { label: 'Storage', current: usageData.usage.storageGb, limit: usageData.limits.maxStorageGb, unit: 'GB' },
                    ].map(({ label, current, limit, unit }) => {
                      const isUnlimited = limit >= UNLIMITED;
                      const pct = isUnlimited ? 0 : Math.min(100, Math.round((current / limit) * 100));
                      const isNear = !isUnlimited && pct >= 80;
                      const isAt = !isUnlimited && current >= limit;
                      return (
                        <div key={label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{label}</span>
                            <span className={isAt ? 'text-destructive font-medium' : isNear ? 'text-yellow-600 dark:text-yellow-400 font-medium' : ''}>
                              {isUnlimited
                                ? `${current}${unit ? ` ${unit}` : ''} / Unlimited`
                                : `${current}${unit ? ` ${unit}` : ''} / ${limit}${unit ? ` ${unit}` : ''}`}
                            </span>
                          </div>
                          {!isUnlimited && (
                            <Progress
                              value={pct}
                              className={`h-1.5 ${isAt ? '[&>div]:bg-destructive' : isNear ? '[&>div]:bg-yellow-500' : ''}`}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-sm font-medium">
                    {billingStatus.planStatus === 'active' ? 'Change plan' : 'Choose a plan'}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      {
                        key: 'starter',
                        label: 'Starter',
                        price: '$29 / month',
                        desc: 'For small teams up to 5 users',
                        features: ['5 team members', '10 projects', 'Basic support'],
                      },
                      {
                        key: 'pro',
                        label: 'Pro',
                        price: '$79 / month',
                        desc: 'Unlimited users and projects',
                        features: ['Unlimited members', 'Unlimited projects', 'Priority support'],
                      },
                      {
                        key: 'enterprise',
                        label: 'Enterprise',
                        price: 'Contact us',
                        desc: 'Custom billing and SLA',
                        features: ['Custom limits', 'Dedicated support', 'SLA guarantee'],
                        contactSales: true,
                      },
                    ].map((tier) => {
                      const isCurrent =
                        billingStatus.plan === tier.key && billingStatus.planStatus === 'active';
                      return (
                        <div
                          key={tier.key}
                          className={`flex flex-col gap-3 rounded-md border p-3 ${isCurrent ? 'border-primary/50 bg-primary/5' : ''}`}
                        >
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <p className="font-semibold text-sm">{tier.label}</p>
                              {isCurrent && <Badge variant="secondary" className="text-xs">Current</Badge>}
                            </div>
                            <p className="text-sm font-medium">{tier.price}</p>
                            <p className="text-xs text-muted-foreground">{tier.desc}</p>
                            <ul className="space-y-0.5 mt-1">
                              {tier.features.map((f) => (
                                <li key={f} className="text-xs text-muted-foreground flex items-center gap-1">
                                  <span className="inline-block h-1 w-1 rounded-full bg-muted-foreground shrink-0" />
                                  {f}
                                </li>
                              ))}
                            </ul>
                          </div>
                          {'contactSales' in tier && tier.contactSales ? (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => window.open('mailto:sales@pixelcraftdesigner.com?subject=Enterprise%20Plan%20Enquiry', '_blank')}
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              Contact sales
                            </Button>
                          ) : (
                            <Button
                              size="sm"
                              variant={isCurrent ? 'secondary' : 'default'}
                              disabled={checkoutMutation.isPending || isCurrent}
                              onClick={() => checkoutMutation.mutate(tier.key)}
                            >
                              <Zap className="h-3 w-3 mr-1" />
                              {isCurrent
                                ? 'Current plan'
                                : billingStatus.planStatus === 'active'
                                ? `Switch to ${tier.label}`
                                : `Upgrade to ${tier.label}`}
                            </Button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {billingStatus.hasStripeCustomer && (
                  <Button
                    variant="outline"
                    disabled={portalMutation.isPending}
                    onClick={() => portalMutation.mutate()}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    {portalMutation.isPending ? 'Opening…' : 'Manage billing in Stripe'}
                  </Button>
                )}

                {billingStatus.planStatus === 'past_due' && (
                  <div className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>Your last payment failed. Please update your payment method to avoid service interruption.</span>
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Loading billing information…</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Invite Team Members — only for admins with an org */}
      {currentUser?.role === "admin" && currentUser?.orgId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Invite Team Members
            </CardTitle>
            <CardDescription>
              Send an email invitation so a colleague can create their account and join your workspace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <Form {...inviteForm}>
              <form
                onSubmit={inviteForm.handleSubmit((v) => sendInviteMutation.mutate(v))}
                className="flex flex-col sm:flex-row gap-3"
              >
                <FormField
                  control={inviteForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem className="flex-1">
                      <FormControl>
                        <Input type="email" placeholder="colleague@yourcompany.com" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={inviteForm.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem className="w-full sm:w-48">
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select role" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="admin">Admin</SelectItem>
                          <SelectItem value="designer">Designer</SelectItem>
                          <SelectItem value="project_manager">Project Manager</SelectItem>
                          <SelectItem value="client">Client</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                {inviteForm.watch("role") === "vendor" && (
                  <FormField
                    control={inviteForm.control}
                    name="linkedVendorId"
                    render={({ field }) => (
                      <FormItem className="w-full sm:w-56">
                        <Select onValueChange={field.onChange} value={field.value ?? ""}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Link to vendor (optional)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {vendors?.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}
                <Button type="submit" disabled={sendInviteMutation.isPending}>
                  {sendInviteMutation.isPending ? "Sending…" : (
                    <><Mail className="h-4 w-4 mr-2" />Send invite</>
                  )}
                </Button>
              </form>
            </Form>

            {/* Pending invitations list */}
            {invitationsLoading ? (
              <p className="text-sm text-muted-foreground">Loading invitations…</p>
            ) : pendingInvitations.length > 0 ? (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Pending invitations</p>
                {pendingInvitations.map((inv) => {
                  const expired = isExpired(inv.expiresAt);
                  return (
                    <div
                      key={inv.id}
                      className="flex items-center justify-between gap-3 p-3 rounded-md border"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{inv.email}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <Badge variant={getRoleBadgeVariant(inv.role)} className="text-xs">
                              {inv.role}
                            </Badge>
                            {expired && (
                              <span className="text-xs text-destructive flex items-center gap-1">
                                <Clock className="h-3 w-3" />Expired
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        {inv.inviteUrl && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => copyInviteLink(inv.inviteUrl!, inv.id)}
                            title="Copy invite link to share manually"
                          >
                            {copiedInviteId === inv.id ? (
                              <><Check className="h-3.5 w-3.5 mr-1.5" />Copied</>
                            ) : (
                              <><Copy className="h-3.5 w-3.5 mr-1.5" />Copy link</>
                            )}
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resendInviteMutation.mutate(inv.id)}
                          disabled={resendInviteMutation.isPending}
                          title="Resend invitation email"
                        >
                          <RefreshCw className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => revokeInviteMutation.mutate(inv.id)}
                          disabled={revokeInviteMutation.isPending}
                          title="Revoke invitation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Team Members
          </CardTitle>
          <CardDescription>
            Assign roles to control access levels. Admins have full access, designers can upload and manage content, clients have read-only access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!users || users.filter(u => u.role !== 'vendor').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No team members found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.filter(u => u.role !== 'vendor').map((user) => {
                const isEditing = editingUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-md border"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate" data-testid={`text-user-name-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        {user.role && (
                          <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            {user.role}
                          </Badge>
                        )}
                        {!user.role && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            No role
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID: <code className="text-xs">{user.id}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      {user.role === "vendor" && (
                        <Select
                          value={user.linkedVendorId ?? ""}
                          onValueChange={(val) => linkVendorMutation.mutate({ userId: user.id, linkedVendorId: val || null })}
                          disabled={linkVendorMutation.isPending}
                        >
                          <SelectTrigger className="w-44" title="Link this user to a vendor record">
                            <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                            <SelectValue placeholder="Link vendor…" />
                          </SelectTrigger>
                          <SelectContent>
                            {vendors?.map((v) => (
                              <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetLinkMutation.mutate(user.id)}
                        disabled={resetLinkMutation.isPending && resetLinkMutation.variables === user.id}
                        title="Generate a password reset link to share with this user"
                      >
                        {copiedUserId === user.id ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5" />Copied</>
                        ) : (
                          <><Link2 className="h-3.5 w-3.5 mr-1.5" />Copy Login Link</>
                        )}
                      </Button>
                      {isEditing ? (
                        <>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="designer">Designer</SelectItem>
                              <SelectItem value="project_manager">Project Manager</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                              <SelectItem value="vendor">Vendor</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveRole(user.id)}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-save-role-${user.id}`}
                          >
                            {updateRoleMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingUserId(null); setSelectedRole(""); }}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-cancel-role-${user.id}`}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingUserId(user.id); setSelectedRole(user.role || "client"); }}
                          data-testid={`button-edit-role-${user.id}`}
                        >
                          Change Role
                        </Button>
                      )}
                      {user.id !== currentUser?.id && !isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmRemoveUserId(user.id)}
                          title="Remove this user from the organisation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Vendors — separate from internal team */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Vendor Portal Users
          </CardTitle>
          <CardDescription>
            Vendors who have been invited to submit quotes via the vendor portal. Each vendor account is linked to a vendor record.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!users || users.filter(u => u.role === 'vendor').length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Building2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No vendor portal users yet</p>
              <p className="text-xs mt-1">Send an RFQ from Comparative Quotes to invite a vendor.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.filter(u => u.role === 'vendor').map((user) => {
                const isEditing = editingUserId === user.id;
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-md border"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate" data-testid={`text-user-name-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1">
                          {getRoleIcon(user.role)}
                          {user.role}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID: <code className="text-xs">{user.id}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <Select
                        value={user.linkedVendorId ?? ""}
                        onValueChange={(val) => linkVendorMutation.mutate({ userId: user.id, linkedVendorId: val || null })}
                        disabled={linkVendorMutation.isPending}
                      >
                        <SelectTrigger className="w-44" title="Link this user to a vendor record">
                          <Building2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
                          <SelectValue placeholder="Link vendor…" />
                        </SelectTrigger>
                        <SelectContent>
                          {vendors?.map((v) => (
                            <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resetLinkMutation.mutate(user.id)}
                        disabled={resetLinkMutation.isPending && resetLinkMutation.variables === user.id}
                        title="Generate a password reset link to share with this user"
                      >
                        {copiedUserId === user.id ? (
                          <><Check className="h-3.5 w-3.5 mr-1.5" />Copied</>
                        ) : (
                          <><Link2 className="h-3.5 w-3.5 mr-1.5" />Copy Login Link</>
                        )}
                      </Button>
                      {isEditing ? (
                        <>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="designer">Designer</SelectItem>
                              <SelectItem value="project_manager">Project Manager</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                              <SelectItem value="vendor">Vendor</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveRole(user.id)}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-save-role-${user.id}`}
                          >
                            {updateRoleMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => { setEditingUserId(null); setSelectedRole(""); }}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-cancel-role-${user.id}`}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => { setEditingUserId(user.id); setSelectedRole(user.role || "vendor"); }}
                          data-testid={`button-edit-role-${user.id}`}
                        >
                          Change Role
                        </Button>
                      )}
                      {user.id !== currentUser?.id && !isEditing && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive hover:text-destructive"
                          onClick={() => setConfirmRemoveUserId(user.id)}
                          title="Remove this user from the organisation"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {assignableUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Briefcase className="h-5 w-5" />
              Project Assignments
            </CardTitle>
            <CardDescription>
              Assign projects to designers, architects, and project managers. Once assigned to at least one project, they will only see their assigned projects.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {projectsLoading || assignmentsLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading project assignments...</div>
            ) : projectsError || assignmentsError ? (
              <div className="text-center py-8 text-destructive">
                <p className="font-medium mb-1">Error loading project assignments</p>
                <p className="text-sm">Please refresh the page to try again</p>
              </div>
            ) : (
              <div className="space-y-6">
                {assignableUsers.map((pm) => (
                  <div key={pm.id} className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b">
                      <Badge variant={getRoleBadgeVariant(pm.role)} className="flex items-center gap-1">
                        {getRoleIcon(pm.role)}
                        {pm.role}
                      </Badge>
                      <p className="font-medium">
                        {(pm.firstName || pm.lastName) ? `${pm.firstName ?? ''} ${pm.lastName ?? ''}`.trim() : (pm.email ?? pm.id)}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        ({allAssignments?.filter(a => a.userId === pm.id).length || 0} projects)
                      </p>
                    </div>
                    {!projects || projects.length === 0 ? (
                      <p className="text-sm text-muted-foreground py-2">No projects available</p>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                        {projects.map((project) => {
                          const isAssigned = isUserAssignedToProject(pm.id, project.id);
                          const isMutating = assignProjectMutation.isPending || unassignProjectMutation.isPending;
                          return (
                            <div
                              key={project.id}
                              className="flex items-center gap-2 p-2 rounded-md border hover-elevate"
                              data-testid={`project-assignment-${pm.id}-${project.id}`}
                            >
                              <Checkbox
                                id={`${pm.id}-${project.id}`}
                                checked={isAssigned}
                                onCheckedChange={() => handleToggleProjectAssignment(pm.id, project.id, isAssigned)}
                                disabled={isMutating}
                                data-testid={`checkbox-project-${pm.id}-${project.id}`}
                              />
                              <label htmlFor={`${pm.id}-${project.id}`} className="text-sm cursor-pointer flex-1">
                                {project.projectName}
                              </label>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Notification Preferences — visible to all authenticated users */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Email Notification Preferences
          </CardTitle>
          <CardDescription>
            Choose which transactional emails you receive about your organisation's account.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[
              {
                key: "planChanges" as const,
                label: "Plan changes",
                description: "Emails when your subscription plan is upgraded, downgraded, or cancelled.",
              },
              {
                key: "paymentFailures" as const,
                label: "Payment failures",
                description: "Emails when a payment attempt for your subscription fails.",
              },
              {
                key: "trialExpiry" as const,
                label: "Trial expiry warnings",
                description: "Emails as your free trial period nears its end.",
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
            ].map(({ key, label, description }) => {
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

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Understanding access levels in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Admin</p>
                <p className="text-muted-foreground">Full system access including user management and all content operations</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCog className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Designer</p>
                <p className="text-muted-foreground">Can upload and manage all project content, vendors, and documents</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCog className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Project Manager</p>
                <p className="text-muted-foreground">Full access to assigned projects only; can upload and manage content for those projects</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Client</p>
                <p className="text-muted-foreground">Read-only access to assigned projects; cannot upload or modify content</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>

    {/* Upgrade dialog — shown when the user limit is hit on invite */}
    <Dialog open={showUserLimitDialog} onOpenChange={setShowUserLimitDialog}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Team member limit reached
          </DialogTitle>
          <DialogDescription>
            Your current plan has reached its maximum number of team members (including pending invitations). Upgrade to add more seats.
          </DialogDescription>
        </DialogHeader>
        <div className="py-2 space-y-2 text-sm text-muted-foreground">
          <p>Upgrading your plan gives you:</p>
          <ul className="list-disc list-inside space-y-1">
            <li>More team member seats</li>
            <li>Higher project and catalogue limits</li>
            <li>Increased storage capacity</li>
          </ul>
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setShowUserLimitDialog(false)}>Cancel</Button>
          <Button onClick={() => { setShowUserLimitDialog(false); navigate("/settings?tab=billing"); }}>
            <Zap className="h-4 w-4 mr-2" />
            View plans
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Remove user confirmation dialog */}
    <Dialog open={!!confirmRemoveUserId} onOpenChange={(open) => { if (!open) setConfirmRemoveUserId(null); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Remove user from organisation?</DialogTitle>
          <DialogDescription>
            {(() => {
              const u = users?.find(u => u.id === confirmRemoveUserId);
              return u ? `${u.firstName || ""} ${u.lastName || ""}`.trim() || u.email : "This user";
            })()} will lose access to the workspace immediately. You can re-invite them later if needed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => setConfirmRemoveUserId(null)} disabled={removeUserMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={() => confirmRemoveUserId && removeUserMutation.mutate(confirmRemoveUserId)}
            disabled={removeUserMutation.isPending}
          >
            {removeUserMutation.isPending ? "Removing…" : "Remove user"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
