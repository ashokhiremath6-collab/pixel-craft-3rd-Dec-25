import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import {
  LogOut,
  Calendar,
  FileText,
  Image,
  PenTool,
  LayoutDashboard,
  Clock,
  BookOpen,
  Download,
  Sparkles,
  CheckCircle2,
  Circle,
  AlertCircle,
  Loader2,
  Users,
  MapPin,
  FileImage,
  File,
  ChevronRight,
  ArrowLeft,
  Receipt,
  SendHorizonal,
  CreditCard,
  Building2,
} from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { differenceInHours } from "date-fns";
import { format, parseISO } from "date-fns";
import type { Project, Moodboard, Specification, MeetingMinutes, Task, VendorCategory } from "@shared/schema";
import { formatCurrencyCompact } from "@/lib/currencyUtils";

interface PortalData {
  project: Project;
  renders: Moodboard[];
  moodboards: Moodboard[];
  workingDrawings: Moodboard[];
  specifications: Specification[];
  meetingMinutes: MeetingMinutes[];
  tasks: Task[];
  orgName?: string;
}

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "timeline", label: "Timeline", icon: Clock },
  { id: "project-cost", label: "Project Cost", icon: Receipt },
  { id: "payments", label: "Payments", icon: CreditCard },
  { id: "renders", label: "Renders", icon: Sparkles },
  { id: "moodboards", label: "Moodboards", icon: Image },
  { id: "drawings", label: "Working Drawings", icon: PenTool },
  { id: "minutes", label: "Meeting Minutes", icon: Calendar },
];

interface ClientPaymentRequest {
  id: string;
  vendorId: string;
  vendorName: string;
  bankName?: string | null;
  accountNumber?: string | null;
  ifscCode?: string | null;
  branch?: string | null;
  amount: string;
  description: string;
  status: string;
  requestedAt: string;
  clientPaidAt?: string | null;
  clientUtr?: string | null;
}

function PaymentsSection({ projectId }: { projectId: string }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [markPaidId, setMarkPaidId] = useState<string | null>(null);
  const [utr, setUtr] = useState("");

  const { data: requests = [], isLoading } = useQuery<ClientPaymentRequest[]>({
    queryKey: ['/api/client-portal', projectId, 'payment-requests'],
    queryFn: () => fetch(`/api/client-portal/${projectId}/payment-requests`).then(r => r.json()),
  });

  const acknowledgeMutation = useMutation({
    mutationFn: (id: string) =>
      apiRequest('PATCH', `/api/payment-requests/${id}/client-acknowledge`, {}),
    onSuccess: () => {
      toast({ title: "Request acknowledged", description: "The designer has been notified." });
      queryClient.invalidateQueries({ queryKey: ['/api/client-portal', projectId, 'payment-requests'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to acknowledge" });
    },
  });

  const markPaidMutation = useMutation({
    mutationFn: ({ id, clientUtr }: { id: string; clientUtr: string }) =>
      apiRequest('PATCH', `/api/payment-requests/${id}/client-confirm`, { clientUtr }),
    onSuccess: () => {
      toast({ title: "Payment submitted", description: "The designer has been alerted and will confirm receipt." });
      setMarkPaidId(null);
      setUtr("");
      queryClient.invalidateQueries({ queryKey: ['/api/client-portal', projectId, 'payment-requests'] });
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to submit payment" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const pending = requests.filter(r => r.status === 'pending');
  const acknowledged = requests.filter(r => r.status === 'acknowledged');
  const awaitingAction = [...pending, ...acknowledged];
  const clientPaid = requests.filter(r => r.status === 'client_paid');
  const confirmed = requests.filter(r => r.status === 'confirmed');

  function PaymentCard({ pr, showAcknowledge }: { pr: ClientPaymentRequest; showAcknowledge: boolean }) {
    return (
      <Card key={pr.id}>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="font-semibold">{pr.vendorName}</div>
              <div className="text-sm text-muted-foreground mt-0.5">{pr.description}</div>
            </div>
            <div className="text-right flex-shrink-0">
              <div className="text-lg font-bold">
                ₹{Number(pr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </div>
              <div className="text-xs text-muted-foreground">Requested {formatDate(pr.requestedAt)}</div>
            </div>
          </div>
          {(pr.bankName || pr.accountNumber || pr.ifscCode) && (
            <div className="rounded-md border bg-muted/30 p-3 space-y-1.5 text-sm">
              <div className="flex items-center gap-1.5 font-medium text-xs uppercase tracking-wide text-muted-foreground mb-2">
                <Building2 className="h-3.5 w-3.5" />
                Bank Details
              </div>
              {pr.bankName && <div className="flex justify-between"><span className="text-muted-foreground">Bank</span><span className="font-medium">{pr.bankName}</span></div>}
              {pr.accountNumber && <div className="flex justify-between"><span className="text-muted-foreground">Account No.</span><span className="font-mono font-medium">{pr.accountNumber}</span></div>}
              {pr.ifscCode && <div className="flex justify-between"><span className="text-muted-foreground">IFSC</span><span className="font-mono font-medium">{pr.ifscCode}</span></div>}
              {pr.branch && <div className="flex justify-between"><span className="text-muted-foreground">Branch</span><span className="font-medium">{pr.branch}</span></div>}
            </div>
          )}
          <div className="flex gap-2">
            {showAcknowledge && (
              <Button
                variant="outline"
                className="flex-1"
                disabled={acknowledgeMutation.isPending}
                onClick={() => acknowledgeMutation.mutate(pr.id)}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Acknowledge
              </Button>
            )}
            <Button
              className="flex-1"
              onClick={() => { setMarkPaidId(pr.id); setUtr(""); }}
            >
              <CreditCard className="h-4 w-4 mr-2" />
              Made Payment
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold mb-1">Payments</h2>
        <p className="text-sm text-muted-foreground">Payment requests from your designer. Acknowledge each request and click "Made Payment" once you have transferred the amount.</p>
      </div>

      {requests.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No payment requests yet.
          </CardContent>
        </Card>
      )}

      {awaitingAction.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Action Required</h3>
          {pending.map(pr => <PaymentCard key={pr.id} pr={pr} showAcknowledge={true} />)}
          {acknowledged.map(pr => <PaymentCard key={pr.id} pr={pr} showAcknowledge={false} />)}
        </div>
      )}

      {clientPaid.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Awaiting Designer Confirmation</h3>
          {clientPaid.map(pr => (
            <Card key={pr.id} className="opacity-75">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{pr.vendorName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pr.description}</div>
                    {pr.clientUtr && <div className="text-xs mt-1">UTR: <span className="font-mono">{pr.clientUtr}</span></div>}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">₹{Number(pr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="flex items-center gap-1 text-xs text-orange-600 mt-1">
                      <Clock className="h-3 w-3" />
                      Payment submitted — awaiting confirmation
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {confirmed.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Completed</h3>
          {confirmed.map(pr => (
            <Card key={pr.id} className="opacity-60">
              <CardContent className="pt-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="font-medium">{pr.vendorName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">{pr.description}</div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="font-bold">₹{Number(pr.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}</div>
                    <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                      <CheckCircle2 className="h-3 w-3" />
                      Confirmed
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Made Payment Dialog */}
      <Dialog open={!!markPaidId} onOpenChange={open => !open && setMarkPaidId(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Confirm Payment</DialogTitle>
            <DialogDescription>Enter your UTR / transaction reference number. The designer will be alerted immediately.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label htmlFor="utr-input">UTR / Reference Number</Label>
            <Input
              id="utr-input"
              value={utr}
              onChange={e => setUtr(e.target.value)}
              placeholder="e.g. HDFC000123456789"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidId(null)}>Cancel</Button>
            <Button
              onClick={() => markPaidId && markPaidMutation.mutate({ id: markPaidId, clientUtr: utr })}
              disabled={markPaidMutation.isPending || !utr.trim()}
            >
              {markPaidMutation.isPending ? "Submitting..." : "Submit Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getFileUrl(filePath?: string | null, fileName?: string | null): string | null {
  if (!fileName) return null;
  if (filePath && filePath.startsWith('/objects/')) return filePath;
  return null;
}

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; }
}

function isImageFile(fileName?: string | null): boolean {
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext || "");
}

// ── OVERVIEW ────────────────────────────────────────────────────────────────
interface VendorAlertClient {
  id: string;
  vendor_name: string;
  project_name: string;
  category_name: string | null;
  quotation_name: string;
  quotation_value: string | null;
  notes: string | null;
  portal_submitted_at: string;
}

function OverviewSection({ project, data, vendorAlerts = [] }: { project?: Project; data?: PortalData; vendorAlerts?: VendorAlertClient[] }) {
  if (!project) return null;

  const completedTasks = (data?.tasks || []).filter(t => t.status === "Completed").length;
  const totalTasks = (data?.tasks || []).length;
  const avgProgress = totalTasks > 0
    ? Math.round((data?.tasks || []).reduce((sum, t) => sum + (Number(t.progressPercentage) || 0), 0) / totalTasks)
    : 0;

  const stats = [
    { label: "Renders", value: data?.renders.length ?? 0, icon: Sparkles },
    { label: "Moodboards", value: data?.moodboards.length ?? 0, icon: Image },
    { label: "Working Drawings", value: data?.workingDrawings.length ?? 0, icon: PenTool },
    { label: "Specifications", value: data?.specifications.length ?? 0, icon: BookOpen },
    { label: "Meeting Minutes", value: data?.meetingMinutes.length ?? 0, icon: Calendar },
    { label: "Schedule Tasks", value: totalTasks, icon: Clock },
  ];

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold">{project.projectName}</h1>
        <p className="text-muted-foreground mt-1">Welcome to your project portal. Everything about your project is here.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Client</p>
            <p className="font-semibold">{project.clientName}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Start Date</p>
            <p className="font-semibold">{formatDate(project.startDate)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Expected Completion</p>
            <p className="font-semibold">{formatDate(project.endDate)}</p>
          </CardContent>
        </Card>
      </div>

      {totalTasks > 0 && (
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">Overall Progress</p>
              <span className="text-sm font-semibold">{avgProgress}%</span>
            </div>
            <div className="h-2.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary rounded-full transition-all"
                style={{ width: `${avgProgress}%` }}
              />
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              {completedTasks} of {totalTasks} tasks completed
            </p>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map(s => (
          <Card key={s.label}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                  <s.icon className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-xl font-bold leading-none">{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {vendorAlerts.length > 0 && (
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center gap-3 flex-wrap">
            <div className="flex items-center justify-center w-8 h-8 rounded-full shrink-0" style={{ background: "#f59e0b" }}>
              <SendHorizonal className="h-3.5 w-3.5 text-white" />
            </div>
            <div>
              <CardTitle className="text-base">Vendor quotes received</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {vendorAlerts.length} vendor{vendorAlerts.length !== 1 ? "s" : ""} submitted {vendorAlerts.length !== 1 ? "quotes" : "a quote"}
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {vendorAlerts.map(alert => {
              const amount = alert.quotation_value
                ? Number(alert.quotation_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                : null;
              const h = differenceInHours(new Date(), new Date(alert.portal_submitted_at));
              const when = h < 1 ? "just now" : h < 24 ? `${h}h ago` : format(new Date(alert.portal_submitted_at), "d MMM");
              return (
                <div
                  key={alert.id}
                  className="rounded-lg p-3 space-y-0.5"
                  style={{ background: "#fffbeb", border: "1px solid #fde68a" }}
                >
                  <p className="text-sm font-semibold" style={{ color: "#92400e" }}>{alert.vendor_name}</p>
                  <p className="text-xs" style={{ color: "#b45309" }}>
                    {alert.category_name || alert.quotation_name}
                  </p>
                  {amount && <p className="text-sm font-medium" style={{ color: "#111827" }}>Quoted: {amount}</p>}
                  {alert.notes && <p className="text-xs text-muted-foreground line-clamp-2">{alert.notes}</p>}
                  <p className="text-xs" style={{ color: "#a8a29e" }}>{when}</p>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ── TIMELINE ─────────────────────────────────────────────────────────────────
function TimelineSection({ tasks }: { tasks: Task[] }) {
  if (tasks.length === 0) {
    return <EmptyState icon={Clock} title="No schedule yet" description="Your project schedule hasn't been published yet." />;
  }

  const topLevel = tasks.filter(t => (t.outlineLevel ?? 1) <= 1);
  const displayTasks = topLevel.length > 0 ? topLevel : tasks;

  function statusIcon(status?: string | null) {
    if (status === "Completed") return <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />;
    if (status === "In Progress") return <Loader2 className="h-4 w-4 text-primary shrink-0" />;
    if (status === "On Hold") return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />;
    return <Circle className="h-4 w-4 text-muted-foreground shrink-0" />;
  }

  function statusColor(status?: string | null) {
    if (status === "Completed") return "default";
    if (status === "In Progress") return "secondary";
    if (status === "On Hold") return "outline";
    return "outline";
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold">Project Schedule</h2>
      <div className="space-y-2">
        {displayTasks.map((task) => {
          const progress = Number(task.progressPercentage) || 0;
          return (
            <Card key={task.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  {statusIcon(task.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">{task.name}</p>
                      <Badge variant={statusColor(task.status) as any} className="text-xs">
                        {task.status || "Not Started"}
                      </Badge>
                    </div>
                    <div className="flex flex-wrap gap-3 text-xs text-muted-foreground mb-2">
                      {task.startDate && <span>Start: {formatDate(task.startDate)}</span>}
                      {task.endDate && <span>End: {formatDate(task.endDate)}</span>}
                    </div>
                    {progress > 0 && (
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary rounded-full"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{progress}%</span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── MEDIA GRID (Renders + Moodboards) ────────────────────────────────────────
function MediaSection({
  title,
  items,
}: {
  title: string;
  items: Moodboard[];
}) {
  const [preview, setPreview] = useState<Moodboard | null>(null);

  if (items.length === 0) {
    const icon = title === "Renders" ? Sparkles : Image;
    return <EmptyState icon={icon} title={`No ${title.toLowerCase()} yet`} description={`${title} will appear here once your designer uploads them.`} />;
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map(item => {
          const url = getFileUrl(item.filePath, item.fileName);
          const isImg = isImageFile(item.fileName);
          return (
            <Card key={item.id} className="overflow-hidden hover-elevate cursor-pointer" onClick={() => url && isImg && setPreview(item)}>
              {url && isImg ? (
                <div className="aspect-video bg-muted overflow-hidden">
                  <img
                    src={url}
                    alt={item.name}
                    className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }}
                  />
                </div>
              ) : (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <FileImage className="h-10 w-10 text-muted-foreground" />
                </div>
              )}
              <CardContent className="pt-3 pb-3">
                <p className="font-medium text-sm truncate">{item.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <p className="text-xs text-muted-foreground">{formatDate(item.uploadedAt?.toString())}</p>
                  {url && (
                    <a
                      href={url}
                      download={item.fileName || item.name}
                      onClick={e => e.stopPropagation()}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
                {item.roomType && item.roomType !== "General" && (
                  <Badge variant="secondary" className="mt-2 text-xs">{item.roomType}</Badge>
                )}
                {item.canvaLink && (
                  <a
                    href={item.canvaLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={e => e.stopPropagation()}
                    className="mt-2 flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline font-medium"
                  >
                    <ChevronRight className="h-3 w-3" /> Open in Canva
                  </a>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {preview && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4"
          onClick={() => setPreview(null)}
        >
          <img
            src={getFileUrl(preview.filePath, preview.fileName) || ""}
            alt={preview.name}
            className="max-w-full max-h-[90vh] object-contain rounded-md"
            onClick={e => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}

// ── WORKING DRAWINGS ──────────────────────────────────────────────────────────
function DrawingsSection({ items }: { items: Moodboard[] }) {
  if (items.length === 0) {
    return <EmptyState icon={PenTool} title="No working drawings yet" description="Floor plans, elevations and other drawings will appear here." />;
  }

  const grouped: Record<string, Moodboard[]> = {};
  items.forEach(item => {
    const folder = item.folder || "General";
    if (!grouped[folder]) grouped[folder] = [];
    grouped[folder].push(item);
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold">Working Drawings</h2>
      {Object.entries(grouped).map(([folder, drawings]) => (
        <div key={folder}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">{folder}</h3>
          <div className="space-y-2">
            {drawings.map(item => {
              const url = getFileUrl(item.filePath, item.fileName);
              const isImg = isImageFile(item.fileName);
              const ext = (item.fileName || "").split(".").pop()?.toUpperCase();
              return (
                <Card key={item.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0">
                        {isImg ? <FileImage className="h-4 w-4 text-muted-foreground" /> : <File className="h-4 w-4 text-muted-foreground" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{ext} · {formatDate(item.uploadedAt?.toString())}</p>
                      </div>
                      {url && (
                        <a
                          href={url}
                          download={item.fileName || item.name}
                          className="shrink-0"
                        >
                          <Button size="icon" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── SPECIFICATIONS ────────────────────────────────────────────────────────────
function SpecificationsSection({ items }: { items: Specification[] }) {
  if (items.length === 0) {
    return <EmptyState icon={BookOpen} title="No specifications yet" description="Finish and material specifications will be published here." />;
  }

  const grouped: Record<string, Specification[]> = {};
  items.forEach(item => {
    const cat = item.category || "General";
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  return (
    <div className="space-y-6 max-w-3xl">
      <h2 className="text-lg font-semibold">Specifications</h2>
      {Object.entries(grouped).map(([category, specs]) => (
        <div key={category}>
          <h3 className="text-sm font-medium text-muted-foreground mb-2 uppercase tracking-wide">{category}</h3>
          <div className="space-y-2">
            {specs.map(spec => {
              const url = getFileUrl(spec.filePath, spec.fileName);
              return (
                <Card key={spec.id}>
                  <CardContent className="pt-3 pb-3">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{spec.title}</p>
                        {spec.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{spec.description}</p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">{spec.fileName}</p>
                      </div>
                      {url && (
                        <a href={url} download={spec.fileName || spec.title} className="shrink-0">
                          <Button size="icon" variant="ghost">
                            <Download className="h-4 w-4" />
                          </Button>
                        </a>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── MEETING MINUTES ───────────────────────────────────────────────────────────
function MinutesSection({ items }: { items: MeetingMinutes[] }) {
  if (items.length === 0) {
    return <EmptyState icon={Calendar} title="No meeting minutes yet" description="Minutes from your design meetings and site visits will appear here." />;
  }

  function meetingTypeBadge(type?: string | null) {
    const map: Record<string, "default" | "secondary" | "outline"> = {
      "Client Meeting": "default",
      "Site Visit": "secondary",
      "Design Review": "secondary",
      "Internal Meeting": "outline",
      "Vendor Meeting": "outline",
    };
    return map[type || ""] || "outline";
  }

  return (
    <div className="space-y-4 max-w-3xl">
      <h2 className="text-lg font-semibold">Meeting Minutes</h2>
      <div className="space-y-3">
        {items.map(item => {
          const url = getFileUrl(item.filePath, item.fileName);
          return (
            <Card key={item.id}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <p className="font-semibold text-sm">{item.meetingTitle}</p>
                      {item.meetingType && (
                        <Badge variant={meetingTypeBadge(item.meetingType)} className="text-xs">
                          {item.meetingType}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mb-1.5">{formatDate(item.meetingDate)}</p>
                    {item.location && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <MapPin className="h-3 w-3" /> {item.location}
                      </div>
                    )}
                    {item.attendees && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                        <Users className="h-3 w-3" /> {item.attendees}
                      </div>
                    )}
                    {item.summary && (
                      <p className="text-xs text-muted-foreground mt-2 line-clamp-3 border-t pt-2">{item.summary}</p>
                    )}
                  </div>
                  {url && (
                    <a href={url} download={item.fileName || item.meetingTitle} className="shrink-0">
                      <Button size="icon" variant="ghost" title="Download minutes">
                        <Download className="h-4 w-4" />
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ── PROJECT COST ──────────────────────────────────────────────────────────────
interface CostQuotation {
  id: string;
  vendorName: string;
  category: string;
  quotationValue: string | null | undefined;
  status: "Quoted" | "Selected" | "Rejected";
  unitRateSubtype?: string | null;
}

function ProjectCostSection({
  projectId,
  categories,
  quotations,
}: {
  projectId: string;
  categories: VendorCategory[];
  quotations: CostQuotation[];
}) {
  const rootCategories = [...categories]
    .filter((c) => !c.parentId)
    .sort((a, b) => a.name.localeCompare(b.name));

  const vendorQuotes = quotations.filter(
    (q) => (q.unitRateSubtype === null || q.unitRateSubtype === undefined) && q.status !== "Rejected"
  );

  const quotedCatNames = new Set(vendorQuotes.map((q) => q.category));
  const quotedCount = rootCategories.filter((cat) => {
    if (quotedCatNames.has(cat.name)) return true;
    return categories
      .filter((c) => c.parentId === cat.id)
      .some((child) => quotedCatNames.has(child.name));
  }).length;

  const getQuotesForCat = (cat: VendorCategory): CostQuotation[] => {
    const childNames = new Set(
      categories.filter((c) => c.parentId === cat.id).map((c) => c.name)
    );
    return vendorQuotes.filter(
      (q) => q.status === "Selected" && (q.category === cat.name || childNames.has(q.category))
    );
  };

  const rows = rootCategories.map((cat, idx) => {
    const catQuotes = getQuotesForCat(cat);
    const catTotal = catQuotes.reduce((s, q) => s + parseFloat(q.quotationValue || "0"), 0);
    const vendorNames = [...new Set(catQuotes.map((q) => q.vendorName))];
    return { cat, catQuotes, catTotal, vendorNames, idx: idx + 1 };
  });

  const total = rows.reduce((sum, r) => sum + r.catTotal, 0);

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="flex items-center justify-between border rounded-md px-4 py-3 bg-muted/30">
        <div>
          <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">
            Total Project Cost
          </p>
          <p className="text-xl font-bold tabular-nums mt-0.5">
            {total > 0 ? formatCurrencyCompact(total) : "—"}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">Categories covered</p>
          <p className="text-sm font-semibold">
            {quotedCount}{" "}
            <span className="text-muted-foreground font-normal">
              / {rootCategories.length}
            </span>
          </p>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-10">
                Sr.
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Category
              </th>
              <th className="text-left px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground">
                Vendor
              </th>
              <th className="text-right px-3 py-2.5 font-semibold text-xs uppercase tracking-wide text-muted-foreground w-32">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ cat, catTotal, vendorNames, idx }) => (
              <tr key={cat.id} className="border-b last:border-b-0 hover:bg-muted/20">
                <td className="px-3 py-2.5 text-muted-foreground text-xs">{idx}</td>
                <td className="px-3 py-2.5 font-medium">{cat.name}</td>
                <td className="px-3 py-2.5 text-muted-foreground">
                  {vendorNames.length > 0 ? vendorNames.join(", ") : (
                    <span className="italic text-muted-foreground/50 text-xs">No quote yet</span>
                  )}
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums font-medium">
                  {catTotal > 0
                    ? formatCurrencyCompact(catTotal)
                    : <span className="text-muted-foreground/40">—</span>}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-muted/40 border-t-2">
              <td className="px-3 py-3" />
              <td colSpan={2} className="px-3 py-3 font-bold text-xs uppercase tracking-wide">
                Total Project Cost
              </td>
              <td className="px-3 py-3 text-right font-bold tabular-nums">
                {total > 0 ? formatCurrencyCompact(total) : "—"}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

// ── EMPTY STATE ───────────────────────────────────────────────────────────────
function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <p className="font-semibold text-base mb-1">{title}</p>
      <p className="text-sm text-muted-foreground max-w-xs">{description}</p>
    </div>
  );
}

// ── MAIN PORTAL APP ───────────────────────────────────────────────────────────
export default function ClientPortalApp({
  previewMode = false,
  onExitPreview,
}: {
  previewMode?: boolean;
  onExitPreview?: () => void;
} = {}) {
  const { user, logout } = useAuth();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [activeTab, setActiveTab] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab && TABS.some(t => t.id === tab)) return tab;
    }
    return "overview";
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/client-portal/projects"],
    staleTime: 5 * 60 * 1000,
  });

  const effectiveProjectId = selectedProjectId || projects[0]?.id || "";

  const { data: portalData, isLoading: dataLoading } = useQuery<PortalData>({
    queryKey: ["/api/client-portal", effectiveProjectId, "summary"],
    queryFn: async () => {
      const res = await fetch(`/api/client-portal/${effectiveProjectId}/summary`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch portal data");
      return res.json();
    },
    enabled: !!effectiveProjectId,
    staleTime: 2 * 60 * 1000,
  });

  const { data: vendorAlertsData = [] } = useQuery<VendorAlertClient[]>({
    queryKey: ["/api/dashboard/vendor-alerts"],
    staleTime: 0,
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    enabled: activeTab === "overview",
  });

  const { data: costCategories = [] } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
    enabled: activeTab === "project-cost",
  });

  const { data: costQuotationsData } = useQuery<{ projects: Project[]; quotations: Record<string, CostQuotation[]> }>({
    queryKey: ["/api/quotations"],
    enabled: activeTab === "project-cost" && !!effectiveProjectId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const costQuotations = costQuotationsData?.quotations?.[effectiveProjectId] ?? [];
  const selectedProject = portalData?.project || projects.find(p => p.id === effectiveProjectId);
  const activeTabMeta = TABS.find(t => t.id === activeTab) ?? TABS[0];

  const sidebarStyle = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3.25rem",
  } as React.CSSProperties;

  const LoadingScreen = () => (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full bg-background items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    </SidebarProvider>
  );

  if (projectsLoading) return <LoadingScreen />;

  if (projects.length === 0) {
    return (
      <SidebarProvider style={sidebarStyle}>
        <div className="flex h-screen w-full bg-background items-center justify-center p-6">
          <div className="text-center max-w-sm">
            <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
              <LayoutDashboard className="h-7 w-7 text-muted-foreground" />
            </div>
            <h2 className="text-lg font-semibold mb-2">No Projects Assigned</h2>
            <p className="text-sm text-muted-foreground">
              You don't have any projects assigned yet. Please contact your designer to get access.
            </p>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  return (
    <SidebarProvider style={sidebarStyle}>
      <div className="flex h-screen w-full bg-background overflow-hidden">

        {/* ── SIDEBAR ── */}
        <Sidebar collapsible="icon">
          <SidebarHeader className="px-3 py-3 border-b">
            <div className="flex items-center gap-2.5 min-w-0">
              <img src="/logo.png" alt="Studio logo" className="h-7 w-7 object-contain shrink-0" />
              <span
                className="font-bold truncate group-data-[collapsible=icon]:hidden"
                style={{ fontSize: "clamp(0.75rem,1.5vw,0.875rem)", letterSpacing: "-0.2px", lineHeight: 1.2 }}
              >
                {portalData?.orgName || selectedProject?.projectName || "Client Portal"}
              </span>
            </div>
          </SidebarHeader>

          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {TABS.map(tab => (
                    <SidebarMenuItem key={tab.id}>
                      <SidebarMenuButton
                        isActive={activeTab === tab.id}
                        onClick={() => setActiveTab(tab.id)}
                        tooltip={tab.label}
                        className="cursor-pointer"
                      >
                        <tab.icon />
                        <span>{tab.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </SidebarContent>

          {projects.length > 1 && (
            <SidebarFooter className="border-t px-3 py-3">
              <Select
                value={effectiveProjectId}
                onValueChange={v => { setSelectedProjectId(v); setActiveTab("overview"); }}
              >
                <SelectTrigger className="w-full group-data-[collapsible=icon]:hidden">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </SidebarFooter>
          )}
        </Sidebar>

        {/* ── MAIN AREA ── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Preview banner */}
          {previewMode && (
            <div className="bg-amber-50 dark:bg-amber-950 border-b border-amber-200 dark:border-amber-800 px-4 py-2 flex items-center justify-between gap-3 shrink-0">
              <p className="text-xs text-amber-800 dark:text-amber-200 font-medium">
                Admin Preview — you are viewing the client portal as a client would see it
              </p>
              <Button size="sm" variant="outline" onClick={onExitPreview} className="text-xs gap-1.5 shrink-0">
                <ArrowLeft className="h-3 w-3" />
                Exit Preview
              </Button>
            </div>
          )}

          {/* Header */}
          <header className="border-b bg-background px-4 py-3 flex items-center justify-between shrink-0 gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <SidebarTrigger />
              <div className="h-5 w-px bg-border hidden sm:block" />
              <div className="flex items-center gap-2 min-w-0">
                <activeTabMeta.icon className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className="font-semibold text-sm truncate">{activeTabMeta.label}</span>
              </div>
              {projects.length === 1 && selectedProject && (
                <span className="text-xs text-muted-foreground truncate hidden sm:block">
                  — {selectedProject.projectName}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="secondary" className="hidden sm:flex text-xs">
                Client Portal
              </Badge>
              {user && !previewMode && (
                <span className="text-sm text-muted-foreground hidden md:block">
                  {user.firstName ? `Hi, ${user.firstName}` : user.email}
                </span>
              )}
              {previewMode ? (
                <Button variant="ghost" size="icon" onClick={onExitPreview} title="Exit Preview">
                  <ArrowLeft className="h-4 w-4" />
                </Button>
              ) : (
                <Button variant="ghost" size="icon" onClick={() => logout()} title="Logout">
                  <LogOut className="h-4 w-4" />
                </Button>
              )}
            </div>
          </header>

          {/* Page content */}
          <main className="flex-1 overflow-auto p-6">
            {dataLoading ? (
              <div className="flex items-center justify-center h-48">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {activeTab === "overview" && (
                  <OverviewSection project={selectedProject} data={portalData} vendorAlerts={vendorAlertsData} />
                )}
                {activeTab === "timeline" && (
                  <TimelineSection tasks={portalData?.tasks || []} />
                )}
                {activeTab === "project-cost" && (
                  <ProjectCostSection
                    projectId={effectiveProjectId}
                    categories={costCategories}
                    quotations={costQuotations}
                  />
                )}
                {activeTab === "payments" && effectiveProjectId && (
                  <PaymentsSection projectId={effectiveProjectId} />
                )}
                {activeTab === "renders" && (
                  <MediaSection title="Renders" items={portalData?.renders || []} />
                )}
                {activeTab === "moodboards" && (
                  <MediaSection title="Moodboards" items={portalData?.moodboards || []} />
                )}
                {activeTab === "drawings" && (
                  <DrawingsSection items={portalData?.workingDrawings || []} />
                )}
                {activeTab === "minutes" && (
                  <MinutesSection items={portalData?.meetingMinutes || []} />
                )}
              </>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
