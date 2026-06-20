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
  { id: "quotes", label: "My Quotes", icon: FileText },
];

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
    enabled: activeTab === "quotes",
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
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-sm">Vendor Portal</span>
            {vendorData?.name && (
              <>
                <span className="text-muted-foreground text-sm hidden sm:inline">/</span>
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
        {activeTab === "quotes" && (
          <QuotesTab quotes={quotesData ?? []} loading={quotesLoading} />
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

function QuotesTab({ quotes, loading }: { quotes: VendorQuote[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!quotes || quotes.length === 0) {
    return (
      <div className="max-w-2xl">
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No quotes yet</p>
          <p className="text-xs mt-1">
            When a studio sends you a quote request, it will appear here.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-4">
      <h2 className="text-base font-semibold">Quote requests</h2>
      <div className="space-y-3">
        {quotes.map((q) => (
          <QuoteCard key={q.id} quote={q} />
        ))}
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: VendorQuote }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [submitNotes, setSubmitNotes] = useState("");

  const statusClass = STATUS_CLASSES[quote.status] ?? STATUS_CLASSES.Quoted;
  const value = quote.quotation_value
    ? Number(quote.quotation_value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : null;

  const alreadySubmitted = !!quote.submitted_at;

  const submitMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/vendor-portal/quotes/${quote.id}/submit`, {
        quotedAmount: amount ? parseFloat(amount) : null,
        notes: submitNotes || null,
      });
      return res;
    },
    onSuccess: () => {
      toast({ title: "Quote submitted", description: "The studio has been notified." });
      queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/my-quotes"] });
      setOpen(false);
    },
    onError: () => {
      toast({ title: "Failed to submit quote", variant: "destructive" });
    },
  });

  return (
    <>
      <Card>
        <CardContent className="p-4 space-y-2">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <p className="text-sm font-medium truncate">{quote.project_name}</p>
              <p className="text-xs text-muted-foreground truncate">
                {quote.category_name || "—"}{quote.quotation_name !== "Main Quote" ? ` · ${quote.quotation_name}` : ""}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {quote.is_negotiated && (
                <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400" />
              )}
              <Badge className={`text-xs ${statusClass}`}>
                {STATUS_LABELS[quote.status] ?? quote.status}
              </Badge>
              <Button
                size="sm"
                variant={alreadySubmitted ? "outline" : "default"}
                onClick={() => { setAmount(quote.quotation_value ? String(quote.quotation_value) : ""); setSubmitNotes(quote.notes || ""); setOpen(true); }}
              >
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {alreadySubmitted ? "Update quote" : "Submit quote"}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            {value && (
              <span className="font-medium text-foreground">{value}</span>
            )}
            {quote.date_of_quotation && (
              <span>Dated {formatDate(quote.date_of_quotation)}</span>
            )}
            {quote.file_count > 0 && (
              <span className="flex items-center gap-1">
                <Paperclip className="h-3 w-3" />
                {quote.file_count} {quote.file_count === 1 ? "file" : "files"}
              </span>
            )}
            {alreadySubmitted && quote.submitted_at && (
              <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                <CheckCircle2 className="h-3 w-3" />
                Submitted {formatDate(quote.submitted_at)}
              </span>
            )}
          </div>
          {quote.notes && (
            <p className="text-xs text-muted-foreground border-t pt-2 line-clamp-2">{quote.notes}</p>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Submit your quote</DialogTitle>
          </DialogHeader>
          <div className="space-y-1 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">{quote.project_name}</span>
            {" · "}{quote.category_name || "—"}
          </div>
          <div className="space-y-4 pt-2">
            <div className="space-y-1">
              <Label htmlFor="quote-amount">Quoted amount</Label>
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
              <Label htmlFor="quote-notes">Notes <span className="text-muted-foreground font-normal">(optional)</span></Label>
              <Textarea
                id="quote-notes"
                placeholder="Scope, materials, lead time, assumptions…"
                rows={4}
                value={submitNotes}
                onChange={(e) => setSubmitNotes(e.target.value)}
              />
            </div>
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
