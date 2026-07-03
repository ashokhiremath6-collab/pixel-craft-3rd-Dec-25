import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Users, Building2, FileText, TrendingUp, ArrowRight, Clock, Download,
  AlertCircle, ImageIcon, LayoutDashboard, FileCheck2, CalendarDays,
  BookOpen, Package, Trash2, Pencil, Plus, Bell, FileUp,
  ChevronDown, ChevronRight, ExternalLink, ArrowUpDown, X, SendHorizonal, FolderOpen,
  CreditCard, CheckCircle2,
} from "lucide-react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Vendor, Project, ActivityLog, Task } from "@shared/schema";
import { formatCurrencyCompact, formatVendorNameWithProjectAndCategory } from "@/lib/currencyUtils";
import { format, formatDistanceToNow, differenceInHours, differenceInDays, startOfDay } from "date-fns";

interface VendorWithCategory extends Omit<Vendor, 'categoryName'> {
  category: string;
}

interface QuotationItem {
  id: string;
  vendorName: string;
  projectName: string;
  quotationValue: string;
  status: "Quoted" | "Selected" | "Rejected";
  dateOfQuotation: string;
  category?: string;
  quotationName?: string;
  quotationType?: string;
  uploaderName?: string | null;
  uploadedAt?: string | null;
}

interface TaskWithMeta extends Task {
  projectName: string;
  daysUntilStart?: number;
  daysToGo?: number;
  daysOverdue?: number;
}

interface ProjectTaskBreakdownEntry {
  projectId: string;
  projectName: string;
  total: number;
  completed: number;
  remaining: number;
  overdueCount?: number;
}

interface RFQAlert {
  id: string;
  email: string;
  invite_message: string | null;
  created_at: string;
  accepted_at: string | null;
  vendor_name: string | null;
  vendor_id: string | null;
  sent_by: string | null;
  project_name: string | null;
  category_name: string | null;
}

interface VendorAlert {
  id: string;
  pv_id?: string | null; // present for project_vendor alerts — the PV row id used for acknowledgement
  vendor_name: string;
  vendor_id: string | null;
  project_name: string | null;
  category_name: string | null;
  quotation_name: string | null;
  quotation_value: string | null;
  notes: string | null;
  submitted_at: string;
  alert_type: 'project_vendor' | 'vendor_document';
  file_name: string | null;
}

interface DashboardProps {
  vendors: VendorWithCategory[];
  projects: Project[];
  recentQuotations: QuotationItem[];
  allQuotations?: QuotationItem[];
  activities?: ActivityLog[];
  taskAlerts?: {
    upcomingStart: TaskWithMeta[];
    completionCountdown: TaskWithMeta[];
    overdue: TaskWithMeta[];
  };
  totalActiveTasks?: number;
  tasksLoading?: boolean;
  projectTaskBreakdown?: ProjectTaskBreakdownEntry[];
  remainingTasksByProject?: Record<string, Array<Task & { projectName: string }>>;
  vendorAlerts?: VendorAlert[];
  rfqAlerts?: RFQAlert[];
  onNavigate?: (path: string) => void;
}

const ACTIVITY_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  accent: string;
  iconBg: string;
  iconColor: string;
}> = {
  floor_plan_upload:        { label: "Floor Plan",        icon: LayoutDashboard, accent: "#eff6ff", iconBg: "#dbeafe", iconColor: "#1d4ed8" },
  floor_plan_delete:        { label: "Floor Plan",        icon: LayoutDashboard, accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  moodboard_upload:         { label: "Moodboard",         icon: ImageIcon,       accent: "#f5f3ff", iconBg: "#ddd6fe", iconColor: "#7c3aed" },
  moodboard_delete:         { label: "Moodboard",         icon: ImageIcon,       accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  render_upload:            { label: "Render",            icon: ImageIcon,       accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  render_delete:            { label: "Render",            icon: ImageIcon,       accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  working_drawing_upload:   { label: "Working Drawing",   icon: FileCheck2,      accent: "#fff7ed", iconBg: "#fed7aa", iconColor: "#c2410c" },
  working_drawing_delete:   { label: "Working Drawing",   icon: FileCheck2,      accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  quote_upload:             { label: "Quotation",         icon: FileText,        accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  quote_file_delete:        { label: "Quotation",         icon: FileText,        accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  schedule_upload:          { label: "Project Schedule",  icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  schedule_reimport:        { label: "Project Schedule",  icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  schedule_delete:          { label: "Project Schedule",  icon: CalendarDays,    accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  schedule:                 { label: "Schedule Update",   icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  specification_upload:     { label: "Specification",     icon: BookOpen,        accent: "#fdf4ff", iconBg: "#e9d5ff", iconColor: "#7e22ce" },
  specification_delete:     { label: "Specification",     icon: BookOpen,        accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  catalogue_upload:         { label: "Catalogue Item",    icon: Package,         accent: "#fefce8", iconBg: "#fef08a", iconColor: "#a16207" },
  catalogue_delete:         { label: "Catalogue Item",    icon: Package,         accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  vendor_create:            { label: "Vendor",            icon: Users,           accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  vendor_update:            { label: "Vendor",            icon: Users,           accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  vendor_delete:            { label: "Vendor",            icon: Users,           accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  task_create:              { label: "Task Added",        icon: Plus,            accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
  task_date_update:         { label: "Date Changed",      icon: CalendarDays,    accent: "#eff6ff", iconBg: "#bfdbfe", iconColor: "#1d4ed8" },
  task_progress_update:     { label: "Progress Update",   icon: TrendingUp,      accent: "#f5f3ff", iconBg: "#ddd6fe", iconColor: "#7c3aed" },
  task_delete:              { label: "Task Deleted",      icon: Trash2,          accent: "#fef2f2", iconBg: "#fecaca", iconColor: "#dc2626" },
  task_bulk_complete:       { label: "Bulk Completed",    icon: FileCheck2,      accent: "#f0fdf4", iconBg: "#bbf7d0", iconColor: "#15803d" },
};

function getActivityConfig(type: string) {
  return ACTIVITY_CONFIG[type] ?? {
    label: type,
    icon: FileUp,
    accent: "#f9fafb",
    iconBg: "#f3f4f6",
    iconColor: "#6b7280",
  };
}

function getActivityVerb(type: string) {
  if (type === "schedule_reimport") return "re-imported";
  if (type.endsWith("_delete")) return "deleted";
  if (type.endsWith("_upload")) return "uploaded";
  if (type.endsWith("_create")) return "added";
  if (type.endsWith("_update")) return "updated";
  return "updated";
}

function relativeTime(dateStr: string) {
  const date = new Date(dateStr);
  const hoursAgo = differenceInHours(new Date(), date);
  if (hoursAgo < 1) return "just now";
  if (hoursAgo < 24) return `${hoursAgo}h ago`;
  if (hoursAgo < 48) return "yesterday";
  return format(date, "d MMM");
}

function isVeryRecent(dateStr: string) {
  return differenceInHours(new Date(), new Date(dateStr)) < 12;
}

function getActivityNavPath(activityType: string, projectId: string | null, meta: Record<string, unknown> | null): string | null {
  const pid = projectId || (meta?.projectId as string | null);
  if (activityType.startsWith('floor_plan_')) return pid ? `/floor-plans?projectId=${pid}` : '/floor-plans';
  if (activityType.startsWith('moodboard_')) return pid ? `/moodboards?projectId=${pid}` : '/moodboards';
  if (activityType.startsWith('render_')) {
    const rid = meta?.moodboardId as string | null;
    if (pid && rid) return `/renders?projectId=${pid}&renderId=${rid}`;
    return pid ? `/renders?projectId=${pid}` : '/renders';
  }
  if (activityType.startsWith('working_drawing_')) {
    const mid = meta?.moodboardId as string | null;
    if (pid && mid) return `/working-drawings?projectId=${pid}&file=${mid}`;
    if (pid) return `/working-drawings?projectId=${pid}`;
    return '/working-drawings';
  }
  if (activityType.startsWith('schedule_') || activityType === 'schedule') return pid ? `/gantt?projectId=${pid}` : '/gantt';
  if (activityType.startsWith('task_')) return pid ? `/gantt?projectId=${pid}` : '/gantt';
  if (activityType.startsWith('quote_') || activityType.startsWith('boq_')) {
    const pvId = meta?.projectVendorId as string | null;
    if (pid && pvId) return `/quotes?project=${pid}&file=${pvId}`;
    if (pid) return `/quotes?project=${pid}`;
    return '/quotes';
  }
  if (activityType.startsWith('specification_')) return '/specifications';
  if (activityType.startsWith('catalogue_')) {
    const cid = meta?.catalogueItemId as string | null;
    return cid ? `/catalogue?item=${cid}` : '/catalogue';
  }
  if (activityType.startsWith('meeting_minutes_')) return '/meeting-minutes';
  if (activityType.startsWith('works_order_')) return pid ? `/gantt?projectId=${pid}` : null;
  return null;
}

type BreakdownSortMode = 'overdue' | 'remaining' | 'alpha' | 'least_complete';
const BREAKDOWN_SORT_LABELS: Record<BreakdownSortMode, string> = {
  overdue: 'Most overdue',
  remaining: 'Most remaining',
  alpha: 'Alphabetical',
  least_complete: 'Least complete',
};

interface VendorCategory { id: string; name: string; }

function AssignToProjectDialog({
  alert,
  open,
  onOpenChange,
  onDone,
}: {
  alert: VendorAlert;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onDone: () => void;
}) {
  const [projectId, setProjectId] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const queryClient = useQueryClient();

  const { data: projects = [] } = useQuery<{ id: string; name: string }[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const { data: categories = [] } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
    enabled: open,
  });

  const flatCategories = (cats: any[]): VendorCategory[] =>
    cats.flatMap((c: any) => [{ id: c.id, name: c.name }, ...flatCategories(c.children ?? [])]);

  const assignMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/vendor-documents/${alert.id}/assign`, {
        projectId,
        categoryId: categoryId || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/vendor-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      onDone();
      onOpenChange(false);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FolderOpen className="h-4 w-4" />
            Assign to project
          </DialogTitle>
          <DialogDescription>
            Move <strong>{alert.file_name || "this document"}</strong> from <strong>{alert.vendor_name}</strong> into the correct project and category so it appears in Comparative Quotes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="space-y-1.5">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.projectName ?? p.project_name ?? p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Category <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="Select category" />
              </SelectTrigger>
              <SelectContent>
                {flatCategories(categories).map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            onClick={() => assignMutation.mutate()}
            disabled={!projectId || assignMutation.isPending}
          >
            {assignMutation.isPending ? "Assigning…" : "Assign to project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const RFQ_DISMISSED_KEY = "dashboard_rfq_dismissed";

function RFQAlertsPanel({ alerts }: { alerts: RFQAlert[] }) {
  const [dismissed, setDismissed] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(RFQ_DISMISSED_KEY);
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  const dismiss = (id: string) => {
    setDismissed(prev => {
      const next = new Set(prev).add(id);
      localStorage.setItem(RFQ_DISMISSED_KEY, JSON.stringify(Array.from(next)));
      return next;
    });
  };

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <ContentCard>
      <div className="px-5 sm:px-8 pt-6 pb-4 space-y-3">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#0071e3" }}>
            <SendHorizonal className="h-4 w-4 text-white" />
          </div>
          <div>
            <h2 className="text-lg sm:text-[22px] font-semibold leading-tight" style={{ color: "#111827" }}>
              RFQs sent
            </h2>
            <p className="text-xs" style={{ color: "#86868b" }}>
              {visible.length} vendor invitation{visible.length !== 1 ? "s" : ""} sent in the last 7 days
            </p>
          </div>
        </div>

        <div className="space-y-2">
          {visible.map(alert => {
            const when = (() => {
              const h = differenceInHours(new Date(), new Date(alert.created_at));
              if (h < 1) return "just now";
              if (h < 24) return `${h}h ago`;
              return format(new Date(alert.created_at), "d MMM");
            })();
            const accepted = !!alert.accepted_at;

            return (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-3 rounded-xl p-3 flex-wrap"
                style={{ background: "#eff6ff", border: "1px solid #bfdbfe" }}
              >
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold" style={{ color: "#1e3a5f" }}>
                      {alert.vendor_name || alert.email}
                    </p>
                    {accepted ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "#dcfce7", color: "#166534" }}>
                        <CheckCircle2 className="h-3 w-3" /> Accepted
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold" style={{ background: "#fef9c3", color: "#854d0e" }}>
                        Pending
                      </span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#3b82f6" }}>
                    {alert.email}
                    {alert.project_name ? ` · ${alert.project_name}` : ""}
                    {alert.category_name ? ` · ${alert.category_name}` : ""}
                  </p>
                  {alert.invite_message && (
                    <p className="text-xs line-clamp-2" style={{ color: "#475569" }}>{alert.invite_message}</p>
                  )}
                  <p className="text-xs" style={{ color: "#94a3b8" }}>
                    Sent {when}{alert.sent_by ? ` by ${alert.sent_by}` : ""}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => dismiss(alert.id)}
                >
                  <X className="h-3.5 w-3.5 mr-1" />
                  Dismiss
                </Button>
              </div>
            );
          })}
        </div>
      </div>
    </ContentCard>
  );
}

function VendorAlertsPanel({ alerts }: { alerts: VendorAlert[] }) {
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const acknowledgeMutation = useMutation({
    mutationFn: async (alert: VendorAlert) => {
      // For project_vendor alerts expanded per file, use pv_id (the PV row) for acknowledgement
      const ackId = alert.alert_type === 'vendor_document'
        ? alert.id
        : (alert.pv_id || alert.id);
      const url = alert.alert_type === 'vendor_document'
        ? `/api/dashboard/vendor-alerts/doc/${ackId}/acknowledge`
        : `/api/dashboard/vendor-alerts/${ackId}/acknowledge`;
      await fetch(url, { method: "PATCH", credentials: "include" });
    },
    onSuccess: (_, alert) => {
      setDismissed(prev => new Set(prev).add(alert.id));
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ["/api/dashboard/vendor-alerts"] }), 300);
    },
  });

  // Auto-acknowledge project_vendor alerts that are older than 24 hours —
  // they've already "moved to normal flow" in Comparative Quotes.
  // Track by pv_id so all file-level rows for the same PV are only acked once.
  const autoAckedRef = useState<Set<string>>(() => new Set())[0];
  useEffect(() => {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000;
    alerts
      .filter(a => {
        const trackKey = a.pv_id || a.id;
        return a.alert_type === 'project_vendor' && !autoAckedRef.has(trackKey) && new Date(a.submitted_at).getTime() < cutoff;
      })
      .forEach(a => {
        const trackKey = a.pv_id || a.id;
        autoAckedRef.add(trackKey);
        acknowledgeMutation.mutate(a);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alerts]);

  const visible = alerts.filter(a => !dismissed.has(a.id));
  if (visible.length === 0) return null;

  return (
    <>
      <ContentCard>
        <div className="px-5 sm:px-8 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#f59e0b" }}>
              <SendHorizonal className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-[22px] font-semibold leading-tight" style={{ color: "#111827" }}>
                Vendor portal submissions
              </h2>
              <p className="text-xs" style={{ color: "#86868b" }}>
                {visible.length} new submission{visible.length !== 1 ? "s" : ""} received through the vendor portal
              </p>
            </div>
          </div>

          <div className="space-y-2">
            {visible.map(alert => {
              const amount = alert.quotation_value
                ? `${(Number(alert.quotation_value) / 100000).toFixed(2)} lacs`
                : null;
              const when = (() => {
                const h = differenceInHours(new Date(), new Date(alert.submitted_at));
                if (h < 1) return "just now";
                if (h < 24) return `${h}h ago`;
                return format(new Date(alert.submitted_at), "d MMM");
              })();
              const isDocAlert = alert.alert_type === 'vendor_document';

              return (
                <div
                  key={alert.id}
                  className="flex items-start justify-between gap-3 rounded-xl p-3 flex-wrap"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                >
                  <div className="flex-1 min-w-0 space-y-0.5">
                    <p className="text-sm font-semibold" style={{ color: "#92400e" }}>
                      {alert.vendor_name}
                    </p>
                    {isDocAlert ? (
                      <p className="text-xs" style={{ color: "#b45309" }}>
                        Uploaded a document via the portal
                        {alert.file_name ? ` · ${alert.file_name}` : ""}
                      </p>
                    ) : (
                      <p className="text-xs" style={{ color: "#b45309" }}>
                        {alert.project_name}{alert.category_name ? ` · ${alert.category_name}` : alert.quotation_name ? ` · ${alert.quotation_name}` : ""}
                      </p>
                    )}
                    {amount && (
                      <p className="text-sm font-medium" style={{ color: "#111827" }}>
                        Quoted: {amount}
                      </p>
                    )}
                    {alert.notes && (
                      <p className="text-xs line-clamp-2" style={{ color: "#78716c" }}>{alert.notes}</p>
                    )}
                    <p className="text-xs" style={{ color: "#a8a29e" }}>{when}</p>
                  </div>
                  {isDocAlert && (
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => acknowledgeMutation.mutate(alert)}
                        disabled={acknowledgeMutation.isPending}
                      >
                        <X className="h-3.5 w-3.5 mr-1" />
                        Dismiss
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </ContentCard>
    </>
  );
}

function ContentCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`bg-white dark:bg-card flex flex-col rounded-[24px] ${className}`}
      style={{
        border: "1px solid #f3f4f6",
        boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
      }}
    >
      {children}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    Selected: { bg: "#dcfce7", text: "#166534" },
    Quoted:   { bg: "#eff6ff", text: "#1d4ed8" },
    Rejected: { bg: "#fef2f2", text: "#991b1b" },
  };
  const c = colors[status] || { bg: "#f3f4f6", text: "#374151" };
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold"
      style={{ background: c.bg, color: c.text }}
    >
      {status}
    </span>
  );
}

interface PaymentAlert {
  id: string;
  vendorId: string;
  vendorName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  projectId?: string | null;
  projectName?: string | null;
  amount: string;
  description: string;
  status: string;
  requestedAt: string;
  clientPaidAt?: string | null;
  clientUtr?: string | null;
}

function PaymentAlertsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [saveDialogAlert, setSaveDialogAlert] = useState<PaymentAlert | null>(null);
  const [deleteConfirmAlert, setDeleteConfirmAlert] = useState<PaymentAlert | null>(null);
  const [paymentDate, setPaymentDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [paymentNotes, setPaymentNotes] = useState("");

  const { data: alerts = [] } = useQuery<PaymentAlert[]>({
    queryKey: ["/api/dashboard/payment-alerts"],
    refetchInterval: 60_000,
  });

  const deletePrMutation = useMutation({
    mutationFn: (id: string) => apiRequest('DELETE', `/api/payment-requests/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/payment-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      setDeleteConfirmAlert(null);
      toast({ title: "Payment request deleted" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to delete payment request" });
    },
  });

  const saveToAccountsMutation = useMutation({
    mutationFn: async ({ alert, date, notes }: { alert: PaymentAlert; date: string; notes: string }) => {
      // Single call: /confirm atomically marks confirmed + creates ledger entries
      await apiRequest('PATCH', `/api/payment-requests/${alert.id}/confirm`, {
        paymentDate: date,
        notes: notes || `Payment received from client. UTR: ${alert.clientUtr || "N/A"}. ${alert.description}`,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/payment-alerts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payment-requests"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors"] });
      setSaveDialogAlert(null);
      setPaymentNotes("");
      toast({ title: "Saved to accounts and confirmed" });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to save to accounts" });
    },
  });

  if (alerts.length === 0) return null;

  return (
    <>
      <ContentCard>
        <div className="px-5 sm:px-8 pt-6 pb-4 space-y-3">
          <div className="flex items-center gap-3 mb-1">
            <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#059669" }}>
              <CreditCard className="h-4 w-4 text-white" />
            </div>
            <div>
              <h2 className="text-lg sm:text-[22px] font-semibold leading-tight" style={{ color: "#111827" }}>
                Client Payments Received
              </h2>
              <p className="text-xs" style={{ color: "#86868b" }}>
                {alerts.length} payment{alerts.length !== 1 ? "s" : ""} marked paid by client — save to accounts to confirm
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-3">
            {alerts.map(alert => (
              <div
                key={alert.id}
                className="flex items-start justify-between gap-4 px-4 py-3 rounded-[12px]"
                style={{ background: "#f0fdf4", border: "1px solid #bbf7d0" }}
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold" style={{ color: "#111827" }}>{alert.vendorName}</span>
                    {alert.projectName && (
                      <span className="text-xs" style={{ color: "#6b7280" }}>· {alert.projectName}</span>
                    )}
                  </div>
                  <p className="text-xs" style={{ color: "#374151" }}>{alert.description}</p>
                  <div className="flex items-center gap-3 flex-wrap text-xs" style={{ color: "#6b7280" }}>
                    <span className="font-semibold" style={{ color: "#059669" }}>
                      ₹{Number(alert.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                    </span>
                    {alert.clientPaidAt && (
                      <span>Paid {format(new Date(alert.clientPaidAt), "dd MMM yyyy")}</span>
                    )}
                    {alert.clientUtr && (
                      <span>UTR: <span className="font-mono">{alert.clientUtr}</span></span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Button
                    size="sm"
                    onClick={() => {
                      setSaveDialogAlert(alert);
                      setPaymentDate(alert.clientPaidAt ? format(new Date(alert.clientPaidAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'));
                      setPaymentNotes("");
                    }}
                    style={{ background: "#059669", color: "#fff" }}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1.5" />
                    Save to Accounts
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => setDeleteConfirmAlert(alert)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </ContentCard>

      {/* Delete Confirmation Dialog */}
      {deleteConfirmAlert && (
        <Dialog open={!!deleteConfirmAlert} onOpenChange={open => !open && setDeleteConfirmAlert(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Delete payment request?</DialogTitle>
              <DialogDescription>
                This will permanently delete the payment request for <strong>{deleteConfirmAlert.vendorName}</strong> — ₹{Number(deleteConfirmAlert.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}. This cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteConfirmAlert(null)}>Cancel</Button>
              <Button
                variant="destructive"
                onClick={() => deletePrMutation.mutate(deleteConfirmAlert.id)}
                disabled={deletePrMutation.isPending}
              >
                {deletePrMutation.isPending ? "Deleting..." : "Delete"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* Save to Accounts Dialog */}
      {saveDialogAlert && (
        <Dialog open={!!saveDialogAlert} onOpenChange={open => !open && setSaveDialogAlert(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Save to Accounts</DialogTitle>
              <DialogDescription>
                Record this payment in the vendor ledger for <strong>{saveDialogAlert.vendorName}</strong> and mark the request as confirmed.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">Amount</span>
                <span className="font-bold text-base">
                  ₹{Number(saveDialogAlert.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {saveDialogAlert.clientUtr && (
                <div className="flex justify-between items-center text-sm">
                  <span className="text-muted-foreground">UTR / Reference</span>
                  <span className="font-mono">{saveDialogAlert.clientUtr}</span>
                </div>
              )}
              <div className="space-y-1.5">
                <Label htmlFor="pay-date">Payment Date</Label>
                <Input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={e => setPaymentDate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="pay-notes">Notes (optional)</Label>
                <Input
                  id="pay-notes"
                  value={paymentNotes}
                  onChange={e => setPaymentNotes(e.target.value)}
                  placeholder="Additional notes for the ledger entry"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setSaveDialogAlert(null)}>Cancel</Button>
              <Button
                onClick={() => saveToAccountsMutation.mutate({ alert: saveDialogAlert, date: paymentDate, notes: paymentNotes })}
                disabled={saveToAccountsMutation.isPending}
                style={{ background: "#059669", color: "#fff" }}
              >
                {saveToAccountsMutation.isPending ? "Saving..." : "Save to Accounts"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

export default function Dashboard({
  vendors,
  projects,
  recentQuotations,
  allQuotations,
  activities = [],
  taskAlerts = { upcomingStart: [], completionCountdown: [], overdue: [] },
  totalActiveTasks = 0,
  tasksLoading = false,
  projectTaskBreakdown = [],
  remainingTasksByProject = {},
  vendorAlerts = [],
  rfqAlerts = [],
  onNavigate,
}: DashboardProps) {
  const { user } = useAuth();
  const { data: org } = useQuery<{ id: string; name: string; logoUrl?: string | null }>({
    queryKey: ["/api/organisations", user?.orgId],
    queryFn: async () => {
      const res = await fetch(`/api/organisations/${user!.orgId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch org");
      return res.json();
    },
    enabled: !!user?.orgId,
    staleTime: 5 * 60 * 1000,
  });

  const [isQuotationDetailModalOpen, setIsQuotationDetailModalOpen] = useState(false);
  const [showAllProjects, setShowAllProjects] = useState(() => localStorage.getItem('dashboard_show_all_projects') === 'true');
  const [breakdownSortMode, setBreakdownSortMode] = useState<BreakdownSortMode>(() => {
    const saved = localStorage.getItem('dashboard_breakdown_sort') as BreakdownSortMode | null;
    return (saved && saved in BREAKDOWN_SORT_LABELS) ? saved : 'remaining';
  });
  const [expandedProjectIds, setExpandedProjectIds] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem('dashboard_expanded_projects');
      return saved ? new Set(JSON.parse(saved) as string[]) : new Set();
    } catch { return new Set(); }
  });

  useEffect(() => {
    localStorage.setItem('dashboard_show_all_projects', showAllProjects ? 'true' : 'false');
  }, [showAllProjects]);

  useEffect(() => {
    localStorage.setItem('dashboard_breakdown_sort', breakdownSortMode);
  }, [breakdownSortMode]);

  useEffect(() => {
    localStorage.setItem('dashboard_expanded_projects', JSON.stringify(Array.from(expandedProjectIds)));
  }, [expandedProjectIds]);

  const toggleProjectExpand = (projectId: string) => {
    setExpandedProjectIds(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) { next.delete(projectId); } else { next.add(projectId); }
      return next;
    });
  };

  const handleNavigate = (path: string) => onNavigate?.(path);

  const vendorsByCategory = vendors.reduce((acc, v) => {
    acc[v.category] = (acc[v.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const activeProjects = projects.filter(
    p => !p.endDate || new Date(p.endDate) > new Date()
  ).length;
  const completedProjects = projects.length - activeProjects;

  const selectedQuotations = (allQuotations || recentQuotations)
    .filter(q => q.status === "Selected")
    .sort((a, b) => {
      const ca = (a.category || "").toLowerCase();
      const cb = (b.category || "").toLowerCase();
      if (ca !== cb) return ca.localeCompare(cb);
      return a.vendorName.toLowerCase().localeCompare(b.vendorName.toLowerCase());
    });

  const totalQuotationValue = selectedQuotations.reduce(
    (sum, q) => sum + parseFloat(q.quotationValue || "0"),
    0
  );

  const hasAlerts =
    taskAlerts.upcomingStart.length > 0 ||
    taskAlerts.completionCountdown.length > 0 ||
    taskAlerts.overdue.length > 0;

  const sortedActivities = [...activities]
    .filter(a => !a.activityType.endsWith("_delete"))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Sort breakdown based on user's chosen mode
  const sortedBreakdown = [...projectTaskBreakdown].sort((a, b) => {
    if (breakdownSortMode === 'overdue') {
      if ((b.overdueCount ?? 0) !== (a.overdueCount ?? 0)) return (b.overdueCount ?? 0) - (a.overdueCount ?? 0);
      return b.remaining - a.remaining;
    }
    if (breakdownSortMode === 'remaining') return b.remaining - a.remaining;
    if (breakdownSortMode === 'alpha') return a.projectName.localeCompare(b.projectName);
    if (breakdownSortMode === 'least_complete') {
      const pctA = a.total > 0 ? a.completed / a.total : 0;
      const pctB = b.total > 0 ? b.completed / b.total : 0;
      return pctA - pctB;
    }
    return 0;
  });

  // Index where overdue projects end (for section divider)
  const firstNonOverdueIdx = sortedBreakdown.findIndex(e => (e.overdueCount ?? 0) === 0);

  // Overdue tasks grouped by project
  const overdueByProject: Record<string, TaskWithMeta[]> = {};
  taskAlerts.overdue.forEach(t => {
    if (!t.projectId) return;
    if (!overdueByProject[t.projectId]) overdueByProject[t.projectId] = [];
    overdueByProject[t.projectId].push(t);
  });
  // Sort overdue tasks within each project: most overdue first (largest daysOverdue)
  Object.values(overdueByProject).forEach(arr => arr.sort((a, b) => (b.daysOverdue ?? 0) - (a.daysOverdue ?? 0)));

  return (
    <div className="min-h-full px-4 py-6 sm:px-8 sm:py-10" style={{ background: "hsl(var(--background))" }}>
      <div className="max-w-[1280px] mx-auto flex flex-col gap-6 sm:gap-10">

        {/* ── Page Header ── */}
        <div className="flex items-center gap-4">
          {org?.logoUrl ? (
            <img
              src={`/api/organisations/${org.id}/logo`}
              alt={org.name}
              title={org.name}
              className="shrink-0 rounded-md bg-white object-contain"
              style={{ height: 72, width: "auto", maxWidth: 220 }}
            />
          ) : (
            <div
              className="shrink-0 rounded-md bg-muted flex items-center justify-center text-muted-foreground font-bold"
              style={{ height: 72, width: 72, fontSize: "1.5rem" }}
              title={org?.name || "Studio"}
            >
              {(org?.name || "S").charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex flex-col gap-0.5">
            <h1
              className="font-semibold leading-tight text-foreground"
              style={{ fontSize: "clamp(1.25rem,3vw,2rem)", letterSpacing: "-0.5px" }}
              data-testid="heading-dashboard"
            >
              {org?.name ?? "Your Studio"}
            </h1>
            <p className="text-sm text-muted-foreground">
              Overview of your vendors, projects, and quotations.
            </p>
          </div>
        </div>

        {/* ── RFQ Sent Alerts ── */}
        {rfqAlerts.length > 0 && (
          <RFQAlertsPanel alerts={rfqAlerts} />
        )}

        {/* ── Vendor Quote Alerts ── */}
        {vendorAlerts.length > 0 && (
          <VendorAlertsPanel alerts={vendorAlerts} />
        )}

        {/* ── Client Payment Alerts ── */}
        <PaymentAlertsPanel />

        {/* ── Latest Activity — PROMINENT HERO SECTION ── */}
        <ContentCard>
          <div className="flex items-center justify-between px-5 sm:px-8 pt-6 pb-3 gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-full" style={{ background: "#0071e3" }}>
                <Bell className="h-4 w-4 text-white" />
              </div>
              <div>
                <h2 className="text-lg sm:text-[22px] font-semibold leading-tight" style={{ color: "#111827" }}>
                  Latest Activity
                </h2>
                <p className="text-xs" style={{ color: "#86868b" }}>
                  Drawings, quotes, schedules and more — everything uploaded across all projects
                </p>
              </div>
            </div>
            {sortedActivities.length > 0 && (
              <span className="text-xs font-medium px-2.5 py-1 rounded-full" style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                {sortedActivities.length} event{sortedActivities.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          {sortedActivities.length === 0 ? (
            <div className="px-8 pb-8 pt-4 text-sm text-center" style={{ color: "#86868b" }}>
              No activity recorded yet. Upload a drawing, quote or schedule to see it here.
            </div>
          ) : (
            <div className="px-4 sm:px-6 pb-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {sortedActivities.slice(0, 18).map(activity => {
                const cfg = getActivityConfig(activity.activityType);
                const IconComp = cfg.icon;
                const activityMeta = activity.metadata as { projectName?: string | null; projectId?: string | null } | null;
                const effectiveProjectId = activity.projectId || activityMeta?.projectId || null;
                const proj = projects.find(p => p.id === effectiveProjectId);
                const projectName = proj?.projectName ?? activityMeta?.projectName ?? null;
                const recent = isVeryRecent(activity.createdAt);
                const verb = getActivityVerb(activity.activityType);
                const navPath = getActivityNavPath(activity.activityType, effectiveProjectId, activityMeta as Record<string, unknown> | null);

                return (
                  <div
                    key={activity.id}
                    data-testid={`activity-${activity.id}`}
                    className={`flex items-start gap-3 px-4 py-3.5 rounded-[14px] relative${navPath ? " cursor-pointer hover-elevate" : ""}`}
                    style={{ background: cfg.accent, border: `1px solid ${cfg.iconBg}` }}
                    onClick={navPath ? () => handleNavigate(navPath) : undefined}
                    role={navPath ? "button" : undefined}
                    tabIndex={navPath ? 0 : undefined}
                    onKeyDown={navPath ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleNavigate(navPath); } } : undefined}
                  >
                    {/* New indicator dot */}
                    {recent && (
                      <span
                        className="absolute top-3 right-3 w-2 h-2 rounded-full"
                        style={{ background: "#0071e3" }}
                        title="Very recent"
                      />
                    )}

                    {/* Icon */}
                    <div
                      className="flex-shrink-0 flex items-center justify-center w-9 h-9 rounded-[10px]"
                      style={{ background: cfg.iconBg }}
                    >
                      <IconComp className="h-4 w-4" style={{ color: cfg.iconColor }} />
                    </div>

                    <div className="flex-1 min-w-0 pr-3">
                      {/* Type badge + verb */}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: cfg.iconColor }}>
                          {cfg.label}
                        </span>
                        <span className="text-[11px]" style={{ color: "#6b7280" }}>{verb}</span>
                      </div>

                      {/* File name */}
                      {activity.fileName && (
                        navPath ? (
                          <button
                            className="text-sm font-medium mt-0.5 truncate flex items-center gap-1 hover:underline text-left w-full"
                            style={{ color: "#111827" }}
                            data-testid={`text-filename-${activity.id}`}
                            title={activity.fileName}
                            onClick={e => { e.stopPropagation(); handleNavigate(navPath); }}
                          >
                            <span className="truncate">{activity.fileName}</span>
                            <ExternalLink className="h-3 w-3 flex-shrink-0" style={{ color: "#9ca3af" }} />
                          </button>
                        ) : (
                          <div
                            className="text-sm font-medium mt-0.5 truncate"
                            style={{ color: "#111827" }}
                            data-testid={`text-filename-${activity.id}`}
                            title={activity.fileName}
                          >
                            {activity.fileName}
                          </div>
                        )
                      )}

                      {/* Description — shown for task and quote activities to convey what changed and why */}
                      {(activity.activityType.startsWith('task_') || activity.activityType.startsWith('quote_') || activity.activityType.startsWith('boq_')) && activity.description && (
                        <p className="text-xs mt-1 leading-snug line-clamp-2" style={{ color: "#374151" }}>
                          {activity.description}
                        </p>
                      )}

                      {/* Who + project + time */}
                      <div className="flex items-center gap-1 flex-wrap mt-1" style={{ color: "#86868b" }}>
                        <span className="text-xs font-medium" style={{ color: "#374151" }} data-testid={`text-user-${activity.id}`}>
                          {activity.userName}
                        </span>
                        {projectName && (
                          <>
                            <span className="text-xs">·</span>
                            <span className="text-xs truncate max-w-[100px]" data-testid={`text-project-${activity.id}`}>
                              {projectName}
                            </span>
                          </>
                        )}
                        <span className="text-xs">·</span>
                        <span className="text-xs whitespace-nowrap" data-testid={`text-time-${activity.id}`}>
                          {relativeTime(activity.createdAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ContentCard>

        {/* ── Two-Column Lower Content ── */}
        <div className="flex flex-col lg:flex-row gap-6 sm:gap-8 items-start">

          {/* Left Column */}
          <div className="flex flex-col gap-6 sm:gap-8 flex-1 min-w-0 w-full">

            {/* Recent Quotations */}
            <ContentCard>
              <div className="flex items-center justify-between px-4 sm:px-8 pt-5 sm:pt-8 pb-3 sm:pb-4 flex-wrap gap-2">
                <h2 className="text-lg sm:text-[22px] font-semibold" style={{ color: "#111827" }}>
                  Recent Quotations
                </h2>
                <button
                  onClick={() => handleNavigate("/quotes")}
                  data-testid="button-view-all-quotes"
                  className="flex items-center gap-1 text-sm font-medium transition-opacity hover:opacity-70"
                  style={{ color: "#0071e3" }}
                >
                  View All
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>

              {recentQuotations.length === 0 ? (
                <div className="px-4 sm:px-8 pb-5 sm:pb-8 text-sm text-center py-8 sm:py-10" style={{ color: "#86868b" }}>
                  No quotations yet.
                </div>
              ) : (
                <div className="px-4 sm:px-8 pb-5 sm:pb-8 flex flex-col gap-3">
                  {recentQuotations.slice(0, 6).map(q => (
                    <div
                      key={q.id}
                      data-testid={`recent-quotation-${q.id}`}
                      className="flex items-center justify-between gap-4 px-4 py-3 rounded-[12px]"
                      style={{ background: "#f9fafb" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium truncate" style={{ color: "#111827" }}>
                          {formatVendorNameWithProjectAndCategory(q.vendorName, q.projectName, q.category)}
                          {q.quotationName && q.quotationName !== "Main Quote" && (
                            <span className="ml-1 font-normal" style={{ color: "#86868b" }}>
                              — {q.quotationName}
                            </span>
                          )}
                          {q.uploaderName && (
                            <span className="ml-2 text-xs text-red-500">new — {q.uploaderName}</span>
                          )}
                        </div>
                        {q.uploadedAt && (
                          <div className="flex items-center gap-1 mt-0.5 text-xs" style={{ color: "#86868b" }}>
                            <Clock className="h-3 w-3" />
                            {format(new Date(q.uploadedAt), "MMM d, yyyy 'at' h:mm a")}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        <span className="font-mono font-semibold text-sm" style={{ color: "#111827" }}>
                          {formatCurrencyCompact(parseFloat(q.quotationValue))}
                        </span>
                        <StatusPill status={q.status} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ContentCard>

            {/* Summary stat strip */}
            <div className="flex flex-col gap-3">
              {/* Row 1: Quoted Value — full width hero stat */}
              <button
                onClick={() => setIsQuotationDetailModalOpen(true)}
                data-testid="stat-total-quotations"
                className="flex items-center justify-between px-6 py-4 rounded-[16px] text-left transition-shadow hover:shadow-md w-full"
                style={{
                  background: "rgba(255,255,255,0.7)",
                  backdropFilter: "blur(12px)",
                  border: "1px solid rgba(255,255,255,0.5)",
                  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                }}
              >
                <span className="text-[13px] font-medium" style={{ color: "#86868b" }}>Orders placed</span>
                <span className="text-[26px] font-bold leading-tight" style={{ color: "#111827" }}>
                  Rs {formatCurrencyCompact(totalQuotationValue)}
                </span>
              </button>

              {/* Row 2: Four secondary stats */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Vendors", value: vendors.length, onClick: () => handleNavigate("/vendors"), testId: "stat-total-vendors", loading: false },
                  { label: "Active Projects", value: activeProjects, onClick: () => handleNavigate("/projects"), testId: "stat-active-projects", loading: false },
                  { label: "Active Tasks", value: totalActiveTasks, onClick: () => handleNavigate("/gantt"), testId: "stat-active-tasks", loading: tasksLoading },
                  { label: "Categories", value: Object.keys(vendorsByCategory).length, onClick: () => handleNavigate("/vendors"), testId: "stat-categories", loading: false },
                ].map(s => (
                  <button
                    key={s.label}
                    onClick={s.onClick}
                    data-testid={s.testId}
                    className="flex items-center justify-between px-4 py-3 rounded-[16px] text-left transition-shadow hover:shadow-md"
                    style={{
                      background: "rgba(255,255,255,0.7)",
                      backdropFilter: "blur(12px)",
                      border: "1px solid rgba(255,255,255,0.5)",
                      boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                    }}
                  >
                    <span className="text-[11px] font-medium" style={{ color: "#86868b" }}>{s.label}</span>
                    {s.loading ? (
                      <span className="text-[20px] font-bold leading-tight" style={{ color: "#d1d5db" }}>—</span>
                    ) : (
                      <span className="text-[20px] font-bold leading-tight" style={{ color: "#111827" }}>{s.value}</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Project Task Breakdown */}
            {(tasksLoading || sortedBreakdown.length > 0) && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4 flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" style={{ color: "#6366f1" }} />
                    <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                      Tasks by Project
                    </h2>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" style={{ color: "#6366f1" }}>
                        <ArrowUpDown className="h-3 w-3" />
                        {BREAKDOWN_SORT_LABELS[breakdownSortMode]}
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {(Object.keys(BREAKDOWN_SORT_LABELS) as BreakdownSortMode[]).map(mode => (
                        <DropdownMenuItem
                          key={mode}
                          onClick={() => setBreakdownSortMode(mode)}
                          className={breakdownSortMode === mode ? "font-semibold" : ""}
                        >
                          {BREAKDOWN_SORT_LABELS[mode]}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-3" data-testid="project-task-breakdown">
                  {tasksLoading ? (
                    <>
                      {[0, 1, 2].map(i => (
                        <div key={i} className="rounded-[12px] overflow-hidden p-3 flex flex-col gap-2" style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}>
                          <div className="flex items-center justify-between gap-2">
                            <Skeleton className="h-3.5 rounded w-2/5" />
                            <Skeleton className="h-3.5 rounded w-16" />
                          </div>
                          <Skeleton className="h-1.5 rounded-full w-full" />
                          <Skeleton className="h-2.5 rounded w-12" />
                        </div>
                      ))}
                    </>
                  ) : null}
                  {!tasksLoading && (showAllProjects ? sortedBreakdown : sortedBreakdown.slice(0, 5)).map((entry, idx) => {
                    const pct = entry.total > 0 ? Math.round((entry.completed / entry.total) * 100) : 0;
                    const hasOverdue = (entry.overdueCount ?? 0) > 0;
                    const isExpanded = expandedProjectIds.has(entry.projectId);
                    const projectOverdueTasks = overdueByProject[entry.projectId] ?? [];
                    const projectRemainingTasks = remainingTasksByProject[entry.projectId] ?? [];
                    const hasExpandableTasks = projectOverdueTasks.length > 0 || projectRemainingTasks.length > 0;
                    // Section labels: only in 'overdue' sort mode when there are overdue projects
                    const hasAnyOverdue = firstNonOverdueIdx > 0;
                    const showOverdueLabel = breakdownSortMode === 'overdue' && hasAnyOverdue && idx === 0;
                    const showOnTrackDivider = breakdownSortMode === 'overdue' && hasAnyOverdue && idx === firstNonOverdueIdx;
                    return (
                      <div key={entry.projectId}>
                        {showOverdueLabel && (
                          <div className="flex items-center gap-2 pb-1">
                            <div className="flex-1 border-t" style={{ borderColor: "#fecaca" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2" style={{ color: "#dc2626" }}>Overdue</span>
                            <div className="flex-1 border-t" style={{ borderColor: "#fecaca" }} />
                          </div>
                        )}
                        {showOnTrackDivider && (
                          <div className="flex items-center gap-2 py-1">
                            <div className="flex-1 border-t" style={{ borderColor: "#e5e7eb" }} />
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2" style={{ color: "#9ca3af" }}>On Track</span>
                            <div className="flex-1 border-t" style={{ borderColor: "#e5e7eb" }} />
                          </div>
                        )}
                        <div
                          className="flex flex-col gap-0 rounded-[12px] overflow-hidden"
                          style={{ background: "#f9fafb", border: "1px solid #f3f4f6" }}
                        >
                          <div className="flex items-stretch">
                            <button
                              data-testid={`breakdown-project-${entry.projectId}`}
                              onClick={() => handleNavigate(`/gantt?projectId=${entry.projectId}`)}
                              className="flex-1 text-left flex flex-col gap-1.5 p-3 hover-elevate active-elevate-2"
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-xs font-medium truncate flex-1 min-w-0" style={{ color: "#111827" }}>
                                  {entry.projectName}
                                </span>
                                <div className="flex items-center gap-1.5 flex-shrink-0">
                                  {hasOverdue && (
                                    <span
                                      className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                                      style={{ background: "#fef2f2", color: "#991b1b" }}
                                      data-testid={`breakdown-overdue-badge-${entry.projectId}`}
                                    >
                                      {entry.overdueCount} overdue
                                    </span>
                                  )}
                                  <span className="text-[11px] font-semibold" style={{ color: "#6366f1" }}>
                                    {entry.completed}/{entry.total}
                                  </span>
                                  <span className="text-[11px] px-1.5 py-0.5 rounded-full font-semibold"
                                    style={{ background: entry.remaining === 0 ? "#dcfce7" : "#eff6ff", color: entry.remaining === 0 ? "#166534" : "#1d4ed8" }}>
                                    {entry.remaining === 0 ? "Done" : `${entry.remaining} left`}
                                  </span>
                                </div>
                              </div>
                              <div className="w-full rounded-full overflow-hidden" style={{ height: 5, background: "#e5e7eb" }}>
                                <div
                                  className="h-full rounded-full transition-all"
                                  style={{ width: `${pct}%`, background: pct === 100 ? "#22c55e" : "#6366f1" }}
                                />
                              </div>
                              <span className="text-[10px]" style={{ color: "#9ca3af" }}>{pct}% complete</span>
                            </button>
                            {hasExpandableTasks && (
                              <button
                                onClick={() => toggleProjectExpand(entry.projectId)}
                                className="px-2 flex items-start pt-3 hover-elevate"
                                title={isExpanded ? "Collapse" : "Show tasks"}
                                style={{ color: "#9ca3af" }}
                              >
                                {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                              </button>
                            )}
                          </div>
                          {isExpanded && hasExpandableTasks && (
                            <div className="border-t flex flex-col gap-0" style={{ borderColor: "#e5e7eb" }}>
                              {projectOverdueTasks.map(task => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]"
                                  style={{ borderBottom: "1px solid #f3f4f6" }}
                                >
                                  <span className="truncate flex-1" style={{ color: "#374151" }}>{task.name}</span>
                                  {task.daysOverdue != null && task.daysOverdue > 0 && (
                                    <span className="flex-shrink-0 font-semibold" style={{ color: "#dc2626" }}>
                                      {task.daysOverdue}d overdue
                                    </span>
                                  )}
                                </div>
                              ))}
                              {projectRemainingTasks.map(task => (
                                <div
                                  key={task.id}
                                  className="flex items-center justify-between gap-2 px-3 py-2 text-[11px]"
                                  style={{ borderBottom: "1px solid #f3f4f6" }}
                                >
                                  <span className="truncate flex-1" style={{ color: "#6b7280" }}>{task.name}</span>
                                  {task.endDate && (
                                    <span className="flex-shrink-0" style={{ color: "#9ca3af" }}>
                                      {format(new Date(task.endDate), "dd MMM")}
                                    </span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {sortedBreakdown.length > 5 && (
                    <button
                      onClick={() => setShowAllProjects(prev => !prev)}
                      className="w-full text-center text-[12px] font-medium py-2 rounded-[12px] hover-elevate active-elevate-2"
                      style={{ color: "#6366f1", background: "#f5f3ff" }}
                    >
                      {showAllProjects
                        ? "Show less"
                        : `Show all ${sortedBreakdown.length} projects`}
                    </button>
                  )}
                </div>
              </ContentCard>
            )}
          </div>

          {/* Right Column */}
          <div className="flex flex-col gap-6 sm:gap-8 w-full lg:w-[340px] lg:flex-shrink-0">

            {/* Task Alerts */}
            {hasAlerts && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4 flex items-center gap-2">
                  <AlertCircle className="h-5 w-5 text-orange-500" />
                  <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                    Task Alerts
                  </h2>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-4">

                  {taskAlerts.upcomingStart.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#eff6ff", color: "#1d4ed8" }}>
                          Starting Soon
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.upcomingStart.length} task{taskAlerts.upcomingStart.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.upcomingStart.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-start-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#eff6ff" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#1e3a8a" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#3b82f6" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                                {task.startDate && ` • ${format(new Date(task.startDate), "dd MMM")}`}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#dbeafe", color: "#1d4ed8" }}>
                              {task.daysUntilStart === 0 ? "Today" : task.daysUntilStart === 1 ? "Tomorrow" : `${task.daysUntilStart}d`}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {taskAlerts.completionCountdown.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#fff7ed", color: "#c2410c" }}>
                          Due Soon
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.completionCountdown.length} task{taskAlerts.completionCountdown.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.completionCountdown.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-countdown-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#fff7ed" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#7c2d12" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#ea580c" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#fed7aa", color: "#c2410c" }}>
                              {task.daysToGo}d left
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {taskAlerts.overdue.length > 0 && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full"
                          style={{ background: "#fef2f2", color: "#991b1b" }}>
                          Overdue
                        </span>
                        <span className="text-xs" style={{ color: "#86868b" }}>
                          {taskAlerts.overdue.length} task{taskAlerts.overdue.length !== 1 ? "s" : ""}
                        </span>
                      </div>
                      <div className="flex flex-col gap-2">
                        {taskAlerts.overdue.slice(0, 5).map(task => (
                          <div
                            key={task.id}
                            data-testid={`alert-overdue-${task.id}`}
                            className="flex items-center justify-between gap-2 px-3 py-2 rounded-[10px]"
                            style={{ background: "#fef2f2" }}
                          >
                            <div className="flex-1 min-w-0">
                              <div className="text-xs font-medium truncate" style={{ color: "#7f1d1d" }}
                                data-testid={`text-task-name-${task.id}`}>
                                {task.name}
                              </div>
                              <div className="text-[10px] mt-0.5" style={{ color: "#ef4444" }}
                                data-testid={`text-project-${task.id}`}>
                                {task.projectName}
                                {task.endDate && ` • Due ${format(new Date(task.endDate), "dd MMM")}`}
                              </div>
                            </div>
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0"
                              style={{ background: "#fecaca", color: "#991b1b" }}>
                              {task.daysOverdue}d
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </ContentCard>
            )}

            {/* Vendor Categories */}
            {Object.keys(vendorsByCategory).length > 0 && (
              <ContentCard>
                <div className="px-6 pt-6 pb-4">
                  <h2 className="text-[18px] font-semibold" style={{ color: "#111827" }}>
                    Vendor Categories
                  </h2>
                </div>
                <div className="px-6 pb-6 flex flex-col gap-2">
                  {Object.entries(vendorsByCategory)
                    .sort((a, b) => b[1] - a[1])
                    .map(([category, count]) => {
                      const maxCount = Math.max(...Object.values(vendorsByCategory));
                      const pct = Math.round((count / maxCount) * 100);
                      return (
                        <div key={category} className="flex items-center gap-3">
                          <span className="text-xs flex-1 truncate" style={{ color: "#374151" }}>
                            {category}
                          </span>
                          <div className="w-20 h-1.5 rounded-full overflow-hidden" style={{ background: "#f3f4f6" }}>
                            <div
                              className="h-full rounded-full"
                              style={{ width: `${pct}%`, background: "#0071e3" }}
                            />
                          </div>
                          <span className="text-xs font-medium w-4 text-right" style={{ color: "#86868b" }}>
                            {count}
                          </span>
                        </div>
                      );
                    })}
                </div>
              </ContentCard>
            )}
          </div>
        </div>

      </div>

      {/* ── Quotation Breakdown Modal ── */}
      <Dialog open={isQuotationDetailModalOpen} onOpenChange={setIsQuotationDetailModalOpen}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle>Project Cost Breakdown</DialogTitle>
            {selectedQuotations.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  try {
                    const res = await fetch("/api/quotations/export-cost-breakdown", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      credentials: "include",
                      body: JSON.stringify({ quotations: selectedQuotations }),
                    });
                    if (!res.ok) throw new Error("Export failed");
                    const blob = await res.blob();
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = `Project_Cost_Breakdown_${new Date().toISOString().split("T")[0]}.xlsx`;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                  } catch {}
                }}
                data-testid="button-export-project-cost"
              >
                <Download className="h-4 w-4 mr-1" />
                Export
              </Button>
            )}
          </DialogHeader>
          <div className="space-y-4">
            {selectedQuotations.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="w-[200px] font-semibold">Vendor</TableHead>
                        <TableHead className="w-[140px] font-semibold">Project</TableHead>
                        <TableHead className="w-[140px] font-semibold">Category</TableHead>
                        <TableHead className="w-[100px] text-right font-semibold">Rs lacs</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedQuotations.map(q => (
                        <TableRow key={q.id} data-testid={`quotation-line-${q.id}`} className="hover:bg-muted/30">
                          <TableCell className="font-medium py-3">{q.vendorName}</TableCell>
                          <TableCell className="py-3">{q.projectName}</TableCell>
                          <TableCell className="py-3 text-muted-foreground">{q.category || "—"}</TableCell>
                          <TableCell className="text-right py-3 font-mono font-semibold tabular-nums">
                            {(parseFloat(q.quotationValue || "0") / 100000).toFixed(2)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="border-t-2 border-primary/20 pt-4 bg-muted/30 -mx-6 px-6 pb-2 rounded-b-lg">
                  <div className="flex items-center justify-between font-semibold text-lg">
                    <span>Total Project Cost</span>
                    <span className="font-mono text-xl tabular-nums" data-testid="modal-total-quotations">
                      {(totalQuotationValue / 100000).toFixed(2)} lacs
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selectedQuotations.length} vendor{selectedQuotations.length !== 1 ? "s" : ""} selected
                  </p>
                </div>
              </>
            ) : (
              <div className="text-center py-8">
                <p className="text-muted-foreground">No selected quotations to display</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
