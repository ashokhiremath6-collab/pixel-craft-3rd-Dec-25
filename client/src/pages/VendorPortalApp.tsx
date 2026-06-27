import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LogOut,
  LayoutDashboard,
  FileText,
  Building2,
  ChevronDown,
  Loader2,
  Package,
  Phone,
  Mail,
  MapPin,
  Tag,
  Paperclip,
  CheckCircle2,
  Send,
  Upload,
  Trash2,
  Download,
  FileIcon,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO } from "date-fns";
import { apiRequest } from "@/lib/queryClient";
import { useLocation } from "wouter";

const TABS = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "instructions", label: "Instructions to Quote", icon: Send },
  { id: "upload", label: "Upload Quote", icon: Upload },
];

interface StudioRequest {
  invite_message: string;
  org_name: string;
  created_at: string;
}

interface VendorDocument {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: string | null;
  uploaded_at: string;
}

export default function VendorPortalApp() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");

  const { data: vendorData, isLoading: vendorLoading } = useQuery<{
    id: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    categoryName: string | null;
  } | null>({
    queryKey: ["/api/vendor-portal/my-vendor"],
    retry: false,
  });

  const { data: quotesData, isLoading: quotesLoading } = useQuery<any[]>({
    queryKey: ["/api/vendor-portal/my-quotes"],
    enabled: activeTab === "upload",
    retry: false,
  });

  const { data: studioRequest, isLoading: requestLoading } = useQuery<StudioRequest | null>({
    queryKey: ["/api/vendor-portal/my-request"],
    retry: false,
  });

  const { data: generalDocs = [], isLoading: docsLoading } = useQuery<VendorDocument[]>({
    queryKey: ["/api/vendor-portal/documents"],
    enabled: activeTab === "upload",
    retry: false,
  });

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((n) => n![0].toUpperCase())
    .join("") || (user?.email?.[0]?.toUpperCase() ?? "V");

  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") ||
    user?.email ||
    "Vendor";

  return (
    <div className="min-h-screen flex flex-col bg-background">
      {/* Top nav */}
      <header className="border-b bg-background shrink-0 sticky top-0 z-50">
        <div className="flex items-center justify-between px-4 sm:px-6 h-14 gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            {studioRequest?.org_name ? (
              <span
                className="font-bold truncate"
                style={{ fontSize: "clamp(0.8rem,1.5vw,1rem)", letterSpacing: "-0.2px" }}
              >
                {studioRequest.org_name}
              </span>
            ) : (
              <span className="font-semibold text-sm">Vendor Portal</span>
            )}
            {vendorData?.name && (
              <>
                <span className="text-muted-foreground text-sm hidden sm:inline shrink-0">/</span>
                <span className="text-sm text-muted-foreground hidden sm:inline truncate max-w-xs">
                  {vendorData.name}
                </span>
              </>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-2 max-w-[180px]">
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className="text-xs">{initials}</AvatarFallback>
                </Avatar>
                <span className="truncate text-sm hidden sm:inline">{displayName}</span>
                <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem onClick={handleLogout} className="gap-2 text-destructive focus:text-destructive">
                <LogOut className="h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Tab strip */}
        <div className="flex px-4 sm:px-6 gap-0 border-t overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={[
                "flex items-center gap-1.5 px-3 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                activeTab === tab.id
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground",
              ].join(" ")}
            >
              <tab.icon className="h-3.5 w-3.5 shrink-0" />
              {tab.label}
            </button>
          ))}
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 overflow-auto p-4 sm:p-6">
        {activeTab === "overview" && (
          <OverviewTab vendorData={vendorData ?? null} loading={vendorLoading} />
        )}
        {activeTab === "instructions" && (
          <InstructionsTab studioRequest={studioRequest ?? null} loading={requestLoading} />
        )}
        {activeTab === "upload" && (
          <UploadTab
            quotes={quotesData ?? []}
            quotesLoading={quotesLoading}
            generalDocs={generalDocs}
            docsLoading={docsLoading}
          />
        )}
      </main>
    </div>
  );
}

function OverviewTab({
  vendorData,
  loading,
}: {
  vendorData: {
    id: string;
    name: string;
    contactName: string | null;
    email: string | null;
    phone: string | null;
    address: string | null;
    categoryName: string | null;
  } | null;
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold">Welcome to your vendor portal</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your profile and manage the quotes that have been sent to you.
        </p>
      </div>

      {vendorData ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              Vendor profile
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <InfoRow icon={Building2} label="Company" value={vendorData.name} />
              {vendorData.contactName && (
                <InfoRow icon={Building2} label="Contact" value={vendorData.contactName} />
              )}
              {vendorData.email && (
                <InfoRow icon={Mail} label="Email" value={vendorData.email} />
              )}
              {vendorData.phone && (
                <InfoRow icon={Phone} label="Phone" value={vendorData.phone} />
              )}
              {vendorData.address && (
                <InfoRow icon={MapPin} label="Address" value={vendorData.address} />
              )}
              {vendorData.categoryName && (
                <InfoRow icon={Tag} label="Category" value={vendorData.categoryName} />
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground text-sm">
            Your vendor profile hasn't been linked yet. Please contact your studio admin.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-medium truncate">{value}</p>
      </div>
    </div>
  );
}

interface VendorQuote {
  id: string;
  quotation_name: string;
  quotation_type: string;
  quotation_value: string | null;
  status: string;
  date_of_quotation: string | null;
  notes: string | null;
  submitted_at: string | null;
  is_negotiated: boolean;
  project_id: string;
  project_name: string;
  category_name: string | null;
  file_count: number;
}

const STATUS_LABELS: Record<string, string> = {
  Quoted: "Quoted",
  Selected: "Selected",
  Rejected: "Rejected",
};

const STATUS_CLASSES: Record<string, string> = {
  Quoted: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  Selected: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  Rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

function formatDate(d?: string | null): string {
  if (!d) return "—";
  try { return format(parseISO(d), "dd MMM yyyy"); } catch { return d; }
}

function InstructionsTab({ studioRequest, loading }: { studioRequest: StudioRequest | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!studioRequest) {
    return (
      <div className="max-w-2xl">
        <div className="text-center py-16 text-muted-foreground">
          <Send className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No instructions yet</p>
          <p className="text-xs mt-1">The studio hasn't provided specific instructions for this quote request.</p>
        </div>
      </div>
    );
  }
  return (
    <div className="max-w-2xl">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Send className="h-4 w-4 text-muted-foreground" />
            Quote request from {studioRequest.org_name}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="bg-muted/50 rounded-md p-4 text-sm">
            <p className="whitespace-pre-wrap leading-relaxed">{studioRequest.invite_message}</p>
          </div>
          <p className="text-xs text-muted-foreground">
            Received {format(new Date(studioRequest.created_at), "d MMM yyyy")} · Go to the <strong>Upload Quote</strong> tab to submit your documents.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function GeneralDocUploadSection({ docs, docsLoading }: { docs: VendorDocument[]; docsLoading: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/vendor-portal/documents/${id}`, { method: "DELETE", credentials: "include" });
      if (!res.ok) throw new Error("Delete failed");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/documents"] }),
    onError: () => toast({ title: "Could not delete file", variant: "destructive" }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selected.forEach(f => formData.append("files", f));
      const res = await fetch("/api/vendor-portal/documents", { method: "POST", credentials: "include", body: formData });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.error || "Upload failed"); }
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/documents"] });
      toast({ title: "Uploaded", description: `${selected.length} file${selected.length !== 1 ? "s" : ""} uploaded successfully.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Upload className="h-4 w-4 text-muted-foreground" />
          Your quote documents
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {docsLoading ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : docs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No documents uploaded yet. Use the button below to attach your quote.</p>
        ) : (
          <div className="space-y-1.5">
            {docs.map(f => (
              <div key={f.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-md px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  <span className="truncate text-sm">{f.file_name}</span>
                  {f.file_size && <span className="text-xs text-muted-foreground shrink-0">{formatFileSize(f.file_size)}</span>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(f.id)} disabled={deleteMutation.isPending}>
                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center gap-3 flex-wrap">
          <label className="cursor-pointer">
            <input type="file" multiple className="hidden" accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png" onChange={handleFileChange} />
            <Button variant="outline" size="sm" asChild disabled={uploading || submitted}>
              <span>
                {uploading
                  ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                  : <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload quote document</>}
              </span>
            </Button>
          </label>
          <p className="text-xs text-muted-foreground">PDF, Excel, Word or images · up to 50 MB each</p>
        </div>

        {docs.length > 0 && (
          submitted ? (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-4 py-3 text-sm text-muted-foreground">
              <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
              <span>Quote submitted to the studio. They will be in touch soon.</span>
            </div>
          ) : (
            <Button
              variant="default"
              size="sm"
              className="w-full"
              onClick={() => {
                setSubmitted(true);
                toast({ title: "Quote submitted", description: "The studio has been notified and will review your documents." });
              }}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              Submit quote to studio
            </Button>
          )
        )}
      </CardContent>
    </Card>
  );
}

function UploadTab({
  quotes,
  quotesLoading,
  generalDocs,
  docsLoading,
}: {
  quotes: VendorQuote[];
  quotesLoading: boolean;
  generalDocs: VendorDocument[];
  docsLoading: boolean;
}) {
  if (quotesLoading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (quotes.length > 0) {
    return (
      <div className="max-w-2xl space-y-4">
        <p className="text-sm text-muted-foreground">
          Upload your quote documents and submit them to the studio. Each quote request is listed below.
        </p>
        <div className="space-y-3">
          {quotes.map(q => <QuoteCard key={q.id} quote={q} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-4">
      <GeneralDocUploadSection docs={generalDocs} docsLoading={docsLoading} />
    </div>
  );
}

interface QuoteFileRecord {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: string | null;
  uploaded_at: string;
}

function formatFileSize(bytes: string | null): string {
  if (!bytes) return "";
  const n = Number(bytes);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

function QuoteCard({ quote }: { quote: VendorQuote }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");

  const statusClass = STATUS_CLASSES[quote.status] ?? STATUS_CLASSES.Quoted;
  const value = quote.quotation_value
    ? Number(quote.quotation_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;
  const alreadySubmitted = !!quote.submitted_at;

  const { data: files = [], isLoading: filesLoading } = useQuery<QuoteFileRecord[]>({
    queryKey: ["/api/vendor-portal/quotes", quote.id, "files"],
    queryFn: async () => {
      const res = await fetch(`/api/vendor-portal/quotes/${quote.id}/files`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to load files");
      return res.json();
    },
    staleTime: 0,
    refetchOnMount: "always",
  });

  const deleteMutation = useMutation({
    mutationFn: async (fileId: string) => {
      const res = await fetch(`/api/vendor-portal/quotes/${quote.id}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete file");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/quotes", quote.id, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/my-quotes"] });
    },
    onError: () => toast({ title: "Could not delete file", variant: "destructive" }),
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", `/api/vendor-portal/quotes/${quote.id}/submit`, {
        quotedAmount: amount ? parseFloat(amount) : null,
        notes: submitNotes || null,
      });
    },
    onSuccess: () => {
      toast({ title: "Quote submitted", description: "The studio has been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/my-quotes"] });
      setOpen(false);
    },
    onError: () => toast({ title: "Failed to submit quote", variant: "destructive" }),
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files || []);
    if (!selected.length) return;
    setUploading(true);
    try {
      const formData = new FormData();
      selected.forEach(f => formData.append("files", f));
      const res = await fetch(`/api/vendor-portal/quotes/${quote.id}/files`, {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Upload failed");
      }
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/quotes", quote.id, "files"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/my-quotes"] });
      toast({ title: "Uploaded", description: `${selected.length} file${selected.length !== 1 ? "s" : ""} added.` });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  }

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-3">
          {/* Header row */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium truncate">{quote.project_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {quote.category_name || "—"}{quote.quotation_name !== "Main Quote" ? ` · ${quote.quotation_name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {quote.is_negotiated && <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />}
              <Badge className={`text-xs ${statusClass}`}>{STATUS_LABELS[quote.status] ?? quote.status}</Badge>
            </div>
          </div>

          {/* Summary row */}
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {value && <span className="font-medium text-foreground">{value}</span>}
            {quote.date_of_quotation && <span>Dated {formatDate(quote.date_of_quotation)}</span>}
            {alreadySubmitted && quote.submitted_at && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Submitted {formatDate(quote.submitted_at)}
              </span>
            )}
          </div>

          {quote.notes && (
            <p className="text-xs text-muted-foreground line-clamp-2">{quote.notes}</p>
          )}

          {/* Documents section */}
          <div className="border-t pt-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <p className="text-xs font-medium flex items-center gap-1.5">
                <Paperclip className="h-3.5 w-3.5" />
                Documents
                {files.length > 0 && (
                  <span className="text-muted-foreground font-normal">({files.length})</span>
                )}
              </p>
              <label className="cursor-pointer">
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={handleFileChange}
                  disabled={uploading}
                />
                <Button size="sm" variant="outline" asChild disabled={uploading}>
                  <span>
                    {uploading
                      ? <><Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />Uploading…</>
                      : <><Upload className="h-3.5 w-3.5 mr-1.5" />Upload documents</>
                    }
                  </span>
                </Button>
              </label>
            </div>

            {filesLoading && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Loader2 className="h-3 w-3 animate-spin" /> Loading files…
              </div>
            )}

            {!filesLoading && files.length === 0 && (
              <p className="text-xs text-muted-foreground py-1">
                No documents yet. Upload your quote — PDF, Word, Excel, CSV, or images accepted.
              </p>
            )}

            {files.length > 0 && (
              <div className="space-y-1">
                {files.map(f => {
                  const filePath = f.file_path.startsWith("/objects/")
                    ? f.file_path.replace("/objects/", "/uploads/")
                    : f.file_path;
                  return (
                    <div
                      key={f.id}
                      className="flex items-center justify-between gap-2 rounded-md px-2.5 py-2"
                      style={{ background: "hsl(var(--muted)/0.4)" }}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <FileIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{f.file_name}</p>
                          {f.file_size && (
                            <p className="text-xs text-muted-foreground">{formatFileSize(f.file_size)}</p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <a href={filePath} download={f.file_name} target="_blank" rel="noreferrer">
                          <Button size="icon" variant="ghost">
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(f.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Submit Quotation — final action below documents */}
          <div className="border-t pt-3">
            <Button
              className="w-full"
              variant="default"
              onClick={() => { setAmount(quote.quotation_value ? String(quote.quotation_value) : ""); setSubmitNotes(quote.notes || ""); setOpen(true); }}
            >
              <Send className="h-4 w-4 mr-2" />
              Submit Quotation
            </Button>
            {alreadySubmitted && quote.submitted_at && (
              <p className="text-xs text-center text-muted-foreground mt-2">
                Last submitted {formatDate(quote.submitted_at)}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Submit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit Quotation</DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{quote.project_name}</span>
            {" · "}{quote.category_name || "—"}
          </div>
          <div className="space-y-4 pt-1">
            <div className="space-y-1">
              <Label htmlFor="quote-amount">
                Quoted amount <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                id="quote-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder="e.g. 125000"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="quote-notes">
                Notes <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Textarea
                id="quote-notes"
                placeholder="Scope, materials, lead time, assumptions, validity period…"
                rows={4}
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
              />
            </div>
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} document{files.length !== 1 ? "s" : ""} attached to this quote.
              </p>
            )}
            {files.length === 0 && (
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Tip: upload your quote documents before submitting.
              </p>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => submitMutation.mutate()} disabled={submitMutation.isPending}>
              {submitMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Send to studio
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
