import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Building2, Users, FolderOpen, TrendingUp, Shield,
  Search, Eye, RefreshCw, ChevronRight, ArrowLeft,
  Clock, Activity, Database, AlertTriangle, CreditCard
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface OrgStats {
  id: string;
  name: string;
  slug: string;
  plan: string;
  planStatus: string;
  createdAt: string;
  currentPeriodEnd: string | null;
  userCount: number;
  projectCount: number;
  lastActivityAt: string | null;
  storageGb: number;
}

interface SubscriptionEvent {
  date: string;
  description: string;
  amount: number | null;
}

interface OrgDetail {
  org: OrgStats & { stripeCustomerId: string | null; stripeSubscriptionId: string | null };
  users: Array<{ id: string; email: string | null; firstName: string | null; lastName: string | null; role: string; createdAt: string | null }>;
  projects: Array<{ id: string; projectName: string; clientName: string }>;
  recentActivity: Array<{ id: string; userName: string; description: string; activityType: string; createdAt: string }>;
  usage: { projects: number; users: number; catalogueItems: number; storageGb: number };
  subscriptionHistory: SubscriptionEvent[];
}

interface Metrics {
  totalOrgs: number;
  trialOrgs: number;
  pastDueOrgs: number;
  activeOrgs: number;
  mrrEstimate: number;
}

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

const PLAN_COLORS: Record<string, BadgeVariant> = {
  trial: "secondary",
  starter: "default",
  pro: "default",
  enterprise: "destructive",
};

const STATUS_COLORS: Record<string, BadgeVariant> = {
  active: "default",
  trialing: "secondary",
  past_due: "destructive",
  cancelled: "destructive",
};

function MetricsPanel({ metrics }: { metrics: Metrics }) {
  const cards = [
    { label: "Total Workspaces", value: metrics.totalOrgs, icon: Building2 },
    { label: "Active Subscriptions", value: metrics.activeOrgs, icon: Activity },
    { label: "On Trial", value: metrics.trialOrgs, icon: Clock },
    { label: "Past Due", value: metrics.pastDueOrgs, icon: AlertTriangle },
    { label: "Est. MRR (USD)", value: `$${metrics.mrrEstimate.toLocaleString()}`, icon: TrendingUp },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map((c) => (
        <Card key={c.label}>
          <CardContent className="pt-4 pb-3 px-4">
            <div className="flex items-center gap-2 text-muted-foreground mb-1">
              <c.icon className="h-4 w-4 shrink-0" />
              <span className="text-xs">{c.label}</span>
            </div>
            <p className="text-2xl font-bold">{c.value}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function OrgDetailPanel({ orgId, onBack }: { orgId: string; onBack: () => void }) {
  const { toast } = useToast();
  const [selectedPlan, setSelectedPlan] = useState<string>("");

  const { data: detail, isLoading } = useQuery<OrgDetail>({
    queryKey: ["/api/superadmin/organisations", orgId],
    queryFn: async () => {
      const res = await fetch(`/api/superadmin/organisations/${orgId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load org detail");
      return res.json();
    },
  });

  const planMutation = useMutation({
    mutationFn: async (plan: string) => {
      return apiRequest("PATCH", `/api/superadmin/organisations/${orgId}/plan`, { plan });
    },
    onSuccess: () => {
      toast({ title: "Plan updated", description: "The organisation plan has been changed." });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/organisations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/superadmin/organisations", orgId] });
    },
    onError: () => toast({ title: "Error", description: "Failed to update plan.", variant: "destructive" }),
  });

  const impersonateMutation = useMutation({
    mutationFn: async (userId: string) => {
      const result = await apiRequest("POST", `/api/superadmin/impersonate/${userId}`);
      return result as { redeemUrl: string; targetEmail: string };
    },
    onSuccess: (data) => {
      // Open the redemption URL in a new tab. The server sets the impersonation
      // session on that tab and redirects to / so the super-admin can browse
      // the app from the impersonated user's perspective, complete with the
      // orange impersonation banner and "Exit impersonation" control.
      window.open(data.redeemUrl, "_blank", "noopener,noreferrer");
      toast({
        title: "Impersonation tab opened",
        description: `A new tab is now running as ${data.targetEmail}. Use the banner in that tab to exit.`,
      });
    },
    onError: () => toast({ title: "Error", description: "Failed to start impersonation.", variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }
  if (!detail) return null;

  const { org, users, projects, recentActivity, usage, subscriptionHistory } = detail;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Back</Button>
        <h2 className="text-lg font-semibold">{org.name}</h2>
        <Badge variant={PLAN_COLORS[org.plan] ?? "default"} className="capitalize">{org.plan}</Badge>
        <Badge variant={STATUS_COLORS[org.planStatus] ?? "default"} className="capitalize">{org.planStatus}</Badge>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 space-y-4">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Override Plan</CardTitle>
            <CardDescription>Change plan directly without going through Stripe.</CardDescription>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Select value={selectedPlan || org.plan} onValueChange={setSelectedPlan}>
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {["trial", "starter", "pro", "enterprise"].map(p => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => planMutation.mutate(selectedPlan || org.plan)}
              disabled={planMutation.isPending}
            >
              {planMutation.isPending ? "Saving..." : "Apply"}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Projects</span><span>{usage.projects}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Users</span><span>{usage.users}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Catalogue items</span><span>{usage.catalogueItems}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Storage</span><span>{usage.storageGb.toFixed(2)} GB</span></div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2"><Users className="h-4 w-4" />Team Members ({users.length})</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {users.map(u => (
              <div key={u.id} className="flex items-center justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.firstName} {u.lastName} <span className="text-muted-foreground font-normal">— {u.email}</span></p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="outline" className="capitalize text-xs">{u.role}</Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => impersonateMutation.mutate(u.id)}
                    disabled={impersonateMutation.isPending}
                    title={`Impersonate ${u.email}`}
                  >
                    <Eye className="h-3 w-3 mr-1" />Impersonate
                  </Button>
                </div>
              </div>
            ))}
            {users.length === 0 && <p className="text-sm text-muted-foreground">No users yet.</p>}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><FolderOpen className="h-4 w-4" />Projects ({projects.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {projects.slice(0, 10).map(p => (
                <div key={p.id} className="text-sm truncate">{p.projectName} <span className="text-muted-foreground">— {p.clientName}</span></div>
              ))}
              {projects.length === 0 && <p className="text-sm text-muted-foreground">No projects yet.</p>}
              {projects.length > 10 && <p className="text-xs text-muted-foreground mt-1">+{projects.length - 10} more</p>}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Activity className="h-4 w-4" />Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {recentActivity.slice(0, 8).map(a => (
                <div key={a.id} className="text-sm">
                  <span className="font-medium">{a.userName}</span>
                  <span className="text-muted-foreground"> {a.description}</span>
                  <span className="text-xs text-muted-foreground ml-1">({formatDistanceToNow(new Date(a.createdAt), { addSuffix: true })})</span>
                </div>
              ))}
              {recentActivity.length === 0 && <p className="text-sm text-muted-foreground">No recent activity.</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4" />Subscription History
          </CardTitle>
          <CardDescription>
            {org.stripeCustomerId
              ? `Stripe customer: ${org.stripeCustomerId}`
              : "No Stripe customer linked to this organisation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {subscriptionHistory.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {org.stripeCustomerId ? "No invoices found." : "Subscription history unavailable — no Stripe customer ID."}
            </p>
          ) : (
            <div className="divide-y text-sm">
              {subscriptionHistory.map((evt, i) => (
                <div key={i} className="py-2 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate">{evt.description}</p>
                    <p className="text-xs text-muted-foreground">{format(new Date(evt.date), "MMM d, yyyy")}</p>
                  </div>
                  {evt.amount != null && (
                    <span className="text-sm font-medium shrink-0">${evt.amount.toFixed(2)}</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function SuperAdminPage() {
  const [, navigate] = useLocation();
  const { user, isLoading: authLoading } = useAuth();

  // All hooks must be called unconditionally before any early returns.
  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [tab, setTab] = useState<"orgs" | "audit">("orgs");
  const { toast } = useToast();

  const isSuperAdmin = !authLoading && !!user?.isSuperAdmin;

  const { data: metrics, isLoading: metricsLoading } = useQuery<Metrics>({
    queryKey: ["/api/superadmin/metrics"],
    enabled: isSuperAdmin,
  });

  const { data: orgs, isLoading: orgsLoading, refetch } = useQuery<OrgStats[]>({
    queryKey: ["/api/superadmin/organisations"],
    enabled: isSuperAdmin,
  });

  const { data: auditLog, isLoading: auditLoading } = useQuery<any[]>({
    queryKey: ["/api/superadmin/audit-log"],
    enabled: isSuperAdmin && tab === "audit",
  });

  // Redirect non-super-admins after hooks run
  useEffect(() => {
    if (!authLoading && user && !user.isSuperAdmin) {
      navigate("/");
    }
  }, [authLoading, user, navigate]);

  // Show nothing while auth state is resolving or if the user lacks access
  if (authLoading || !user?.isSuperAdmin) {
    return null;
  }

  const filtered = (orgs ?? []).filter(o => {
    const matchSearch = !search ||
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      o.slug.toLowerCase().includes(search.toLowerCase());
    const matchPlan = planFilter === "all" || o.plan === planFilter;
    const matchStatus = statusFilter === "all" || o.planStatus === statusFilter;
    return matchSearch && matchPlan && matchStatus;
  });

  if (selectedOrgId) {
    return (
      <div className="max-w-5xl mx-auto space-y-6">
        <OrgDetailPanel orgId={selectedOrgId} onBack={() => setSelectedOrgId(null)} />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Shield className="h-6 w-6 text-destructive" />
        <div>
          <h1 className="text-xl font-bold">Super-Admin Console</h1>
          <p className="text-sm text-muted-foreground">System-level visibility across all customer organisations.</p>
        </div>
      </div>

      {metricsLoading ? (
        <div className="text-sm text-muted-foreground">Loading metrics...</div>
      ) : metrics ? (
        <MetricsPanel metrics={metrics} />
      ) : null}

      <div className="flex gap-2 border-b">
        {(["orgs", "audit"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-3 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
              tab === t
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "orgs" ? "Organisations" : "Audit Log"}
          </button>
        ))}
      </div>

      {tab === "orgs" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or slug..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={planFilter} onValueChange={setPlanFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All plans" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All plans</SelectItem>
                {["trial", "starter", "pro", "enterprise"].map(p => (
                  <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-36">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                {["trialing", "active", "past_due", "cancelled"].map(s => (
                  <SelectItem key={s} value={s} className="capitalize">{s.replace("_", " ")}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => refetch()} title="Refresh">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>

          {orgsLoading ? (
            <div className="text-sm text-muted-foreground">Loading organisations...</div>
          ) : (
            <Card>
              <div className="divide-y">
                {filtered.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground text-sm">No organisations match your filters.</div>
                )}
                {filtered.map(org => (
                  <button
                    key={org.id}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover-elevate"
                    onClick={() => setSelectedOrgId(org.id)}
                  >
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{org.name}</span>
                        <span className="text-xs text-muted-foreground">/{org.slug}</span>
                        <Badge variant={PLAN_COLORS[org.plan] ?? "default"} className="capitalize text-xs">{org.plan}</Badge>
                        <Badge variant={STATUS_COLORS[org.planStatus] ?? "default"} className="capitalize text-xs">{org.planStatus.replace("_", " ")}</Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-0.5 text-xs text-muted-foreground flex-wrap">
                        <span className="flex items-center gap-1"><Users className="h-3 w-3" />{org.userCount} users</span>
                        <span className="flex items-center gap-1"><FolderOpen className="h-3 w-3" />{org.projectCount} projects</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {org.lastActivityAt
                            ? `Active ${formatDistanceToNow(new Date(org.lastActivityAt), { addSuffix: true })}`
                            : "No activity recorded"}
                        </span>
                        <span>Created {format(new Date(org.createdAt), "MMM d, yyyy")}</span>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  </button>
                ))}
              </div>
            </Card>
          )}
        </div>
      )}

      {tab === "audit" && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Database className="h-4 w-4" />Audit Log</CardTitle>
            <CardDescription>All super-admin actions are recorded here.</CardDescription>
          </CardHeader>
          <CardContent>
            {auditLoading ? (
              <div className="text-sm text-muted-foreground">Loading audit log...</div>
            ) : (auditLog ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">No audit log entries yet.</p>
            ) : (
              <div className="divide-y text-sm">
                {(auditLog ?? []).map((entry: any) => (
                  <div key={entry.id} className="py-2 flex items-start gap-3">
                    <Shield className="h-3 w-3 mt-1 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium capitalize">{entry.action.replace("_", " ")}</span>
                      {entry.metadata && (
                        <span className="text-muted-foreground ml-1">
                          {entry.action === "plan_override" && entry.metadata.previousPlan && entry.metadata.newPlan
                            ? `(${entry.metadata.previousPlan} → ${entry.metadata.newPlan})`
                            : entry.metadata.targetEmail
                            ? `(${entry.metadata.targetEmail})`
                            : ""}
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">
                      {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
