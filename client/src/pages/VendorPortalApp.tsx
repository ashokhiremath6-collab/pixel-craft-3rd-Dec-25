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
} from "lucide-react";
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

function QuotesTab({ quotes, loading }: { quotes: any[]; loading: boolean }) {
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
        {quotes.map((q: any) => (
          <QuoteCard key={q.id} quote={q} />
        ))}
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: any }) {
  const statusColors: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
    submitted: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
    rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  };
  const statusClass = statusColors[quote.status] ?? statusColors.pending;

  return (
    <Card>
      <CardContent className="p-4 flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-sm font-medium truncate">{quote.projectName || "Project"}</p>
          <p className="text-xs text-muted-foreground truncate">
            {quote.categoryName || "Category"} — {quote.vendorName || ""}
          </p>
        </div>
        <Badge className={`text-xs shrink-0 ${statusClass}`}>
          {quote.status ?? "pending"}
        </Badge>
      </CardContent>
    </Card>
  );
}
