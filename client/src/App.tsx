import { useState, useEffect } from "react";
import { Switch, Route, useLocation } from "wouter";
import { queryClient, apiRequest } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/DashboardPage";
import SuperAdminPage from "@/pages/SuperAdminPage";
import VendorsPage from "@/pages/VendorsPage";
import ProjectsPage from "@/pages/ProjectsPage";
import FloorPlansPage from "@/pages/FloorPlansPage";
import GanttChartPage from "@/pages/GanttChartPage";
import QuotesPage from "@/pages/QuotesPage";
import UnitRatesPage from "@/pages/UnitRatesPage";
import TemplatesPage from "@/pages/TemplatesPage";
import TemplateViewPage from "@/pages/TemplateViewPage";
import ImportPage from "@/pages/ImportPage";
import SettingsPage from "@/pages/SettingsPage";
import AccountPage from "@/pages/AccountPage";
import ClientAccessPage from "@/pages/ClientAccessPage";
import MoodboardsPage from "@/pages/MoodboardsPage";
import AccountsPage from "@/pages/AccountsPage";
import CataloguePage from "@/pages/CataloguePage";
import SpecificationsPage from "@/pages/SpecificationsPage";
import SOPsPage from "@/pages/SOPsPage";
import MeetingMinutesPage from "@/pages/MeetingMinutesPage";
import WorksOrdersPage from "@/pages/WorksOrdersPage";
import ClientPortalApp from "@/pages/ClientPortalApp";
import AIRendersPage from "@/pages/AIRendersPage";
import AssetIngestionPage from "@/pages/AssetIngestionPage";
import AIAssistantPage from "@/pages/AIAssistantPage";
import LoginPage from "@/pages/LoginPage";
import LandingPage from "@/pages/LandingPage";
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import SignUpPage from "@/pages/SignUpPage";
import InviteAcceptPage from "@/pages/InviteAcceptPage";
import OnboardingWizard from "@/components/OnboardingWizard";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, User, Crown, Eye, AlertTriangle, X, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { BILLING_VISIBLE_ROLES } from "@shared/schema";

const TRIAL_BANNER_DISMISS_KEY = "trial_expiry_banner_dismissed_until";
const TRIAL_WARNING_DAYS = 3;

const ELEVATED_ROLES = ['admin', 'designer', 'project_manager'];

function Router() {
  return (
    <Switch>
      <Route path="/" component={DashboardPage} />
      <Route path="/projects" component={ProjectsPage} />
      <Route path="/gantt-chart" component={GanttChartPage} />
      <Route path="/gantt" component={GanttChartPage} />
      <Route path="/schedule" component={GanttChartPage} />
      <Route path="/floor-plans" component={() => { window.location.replace('/working-drawings'); return null; }} />
      <Route path="/vendors" component={VendorsPage} />
      <Route path="/quotes" component={QuotesPage} />
      <Route path="/unit-rates" component={UnitRatesPage} />
      <Route path="/templates" component={TemplatesPage} />
      <Route path="/templates/:id" component={TemplateViewPage} />
      <Route path="/import" component={ImportPage} />
      <Route path="/accounts" component={AccountsPage} />
      <Route path="/catalogue" component={CataloguePage} />
      <Route path="/specifications" component={SpecificationsPage} />
      <Route path="/meeting-minutes" component={MeetingMinutesPage} />
      <Route path="/works-orders" component={WorksOrdersPage} />
      <Route path="/moodboards" component={MoodboardsPage} />
      <Route path="/working-drawings" component={MoodboardsPage} />
      <Route path="/renders" component={MoodboardsPage} />
      <Route path="/ai-renders" component={AIRendersPage} />
      <Route path="/asset-ingestion" component={AssetIngestionPage} />
      <Route path="/ai-assistant" component={AIAssistantPage} />
      <Route path="/client-access" component={ClientAccessPage} />
      <Route path="/sops" component={SOPsPage} />
      <Route path="/settings" component={SettingsPage} />
      <Route path="/account" component={AccountPage} />
      <Route path="/superadmin" component={SuperAdminPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

interface BillingStatus {
  plan: string;
  planStatus: string;
  currentPeriodEnd: string | null;
  hasStripeCustomer: boolean;
}

function AuthenticatedApp({ onPreviewClientPortal }: { onPreviewClientPortal: () => void }) {
  const { logout, user } = useAuth();

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  const canPreviewPortal = ELEVATED_ROLES.includes(user?.role || '');

  const isAdmin = user?.role === 'admin';
  const canSeeBilling = (BILLING_VISIBLE_ROLES as readonly string[]).includes(user?.role || '');
  const { data: billingStatus } = useQuery<BillingStatus>({
    queryKey: ["/api/billing/status"],
    enabled: canSeeBilling && !!user?.orgId,
  });

  const daysUntilTrialEnd = (() => {
    if (!billingStatus?.currentPeriodEnd) return null;
    const end = new Date(billingStatus.currentPeriodEnd);
    const now = new Date();
    const diffMs = end.getTime() - now.getTime();
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  })();

  const trialExpiryDismissKey = billingStatus?.currentPeriodEnd
    ? `${TRIAL_BANNER_DISMISS_KEY}_${billingStatus.currentPeriodEnd}`
    : null;
  const [trialBannerDismissed, setTrialBannerDismissed] = useState<boolean>(false);

  useEffect(() => {
    if (!trialExpiryDismissKey) return;
    const raw = localStorage.getItem(trialExpiryDismissKey);
    if (!raw) { setTrialBannerDismissed(false); return; }
    // Support legacy format (plain epoch number) and new JSON format
    let snoozedUntil: number;
    try {
      const parsed = JSON.parse(raw);
      snoozedUntil = typeof parsed === 'object' ? parsed.snoozedUntil : parsed;
    } catch {
      snoozedUntil = parseInt(raw, 10);
    }
    setTrialBannerDismissed(Date.now() < snoozedUntil);
  }, [trialExpiryDismissKey]);

  const dismissTrialBanner = (days: number | 'forever') => {
    if (trialExpiryDismissKey) {
      let snoozedUntil: number;
      if (days === 'forever') {
        // Far-future date: year 9999
        snoozedUntil = new Date(9999, 11, 31).getTime();
      } else {
        // Exact duration from now: "1 day" means reappear after 24 h, not after end-of-day+1
        snoozedUntil = Date.now() + days * 24 * 60 * 60 * 1000;
      }
      localStorage.setItem(
        trialExpiryDismissKey,
        JSON.stringify({ snoozedUntil, snoozeDuration: days }),
      );
    }
    setTrialBannerDismissed(true);
  };

  const showTrialExpiryBanner =
    canSeeBilling &&
    !!user?.orgId &&
    !!billingStatus &&
    billingStatus.planStatus === 'trialing' &&
    daysUntilTrialEnd !== null &&
    daysUntilTrialEnd >= 0 &&
    daysUntilTrialEnd <= TRIAL_WARNING_DAYS &&
    !trialBannerDismissed;

  const showUrgentBillingBanner =
    canSeeBilling &&
    !!user?.orgId &&
    !!billingStatus &&
    (billingStatus.planStatus === 'past_due' ||
     billingStatus.planStatus === 'cancelled');

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-2 sm:p-4 border-b bg-background shrink-0 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2 min-w-0">
                <img src="/logo.png" alt="Olympik Design" className="h-7 w-7 object-contain shrink-0" />
                <h1 className="text-sm sm:text-base font-semibold truncate hidden sm:block" data-testid="heading-app-title">
                  Olympik Design
                </h1>
              </div>
            </div>
            <div className="flex items-center gap-1 sm:gap-3 shrink-0">
              {user && (
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      user.role === 'admin' ? 'destructive' :
                      user.role === 'designer' ? 'default' :
                      'secondary'
                    }
                    className="capitalize flex items-center gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 text-xs"
                    data-testid="badge-user-role"
                  >
                    {user.role === 'admin' && <Crown className="h-3 w-3" />}
                    {user.role === 'designer' && <Shield className="h-3 w-3" />}
                    {user.role === 'client' && <User className="h-3 w-3" />}
                    <span className="hidden sm:inline">{user.role}</span>
                  </Badge>
                </div>
              )}
              {canPreviewPortal && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onPreviewClientPortal}
                  title="Preview Client Portal"
                  data-testid="button-preview-client-portal"
                >
                  <Eye className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => logout()}
                data-testid="button-logout"
                title="Logout"
              >
                <LogOut className="h-4 w-4" />
              </Button>
              <ThemeToggle />
            </div>
          </header>
          {/* Impersonation banner — shown when a super-admin is acting as another user */}
          {user?._impersonating && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0 bg-orange-100 dark:bg-orange-950/40 text-orange-900 dark:text-orange-300 border-b border-orange-200 dark:border-orange-800">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 shrink-0" />
                <span>Impersonating <strong>{user?.email}</strong> — you are viewing the app as this user.</span>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await apiRequest("POST", "/api/superadmin/impersonate/exit");
                    queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
                    setTimeout(() => window.location.reload(), 400);
                  } catch {
                    window.location.reload();
                  }
                }}
              >
                Exit impersonation
              </Button>
            </div>
          )}
          {showTrialExpiryBanner && (
            <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-b border-amber-200 dark:border-amber-800">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>
                  {daysUntilTrialEnd === 0
                    ? 'The free trial expires today.'
                    : daysUntilTrialEnd === 1
                    ? 'The free trial expires tomorrow.'
                    : `The free trial expires in ${daysUntilTrialEnd} days.`}{' '}
                  {isAdmin
                    ? 'Upgrade to keep access to all features.'
                    : 'Please ask your workspace admin to upgrade.'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isAdmin && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => window.location.href = '/settings'}
                    data-testid="button-trial-banner-upgrade"
                  >
                    Upgrade now
                  </Button>
                )}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="flex items-center gap-1"
                      data-testid="button-trial-banner-dismiss"
                    >
                      <X className="h-3.5 w-3.5" />
                      <ChevronDown className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => dismissTrialBanner(1)}>
                      Remind me tomorrow
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => dismissTrialBanner(3)}>
                      Remind me in 3 days
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => dismissTrialBanner('forever')}>
                      Don't show again
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
          {showUrgentBillingBanner && (
            <div className={`flex items-center justify-between gap-3 px-4 py-2 text-sm shrink-0 border-b ${billingStatus?.planStatus === 'past_due' ? 'bg-destructive/10 text-destructive border-destructive/20' : 'bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                {isAdmin
                  ? (billingStatus?.planStatus === 'past_due'
                    ? 'Your payment is past due. Please update your billing details to avoid service interruption.'
                    : 'Your subscription has been cancelled. Resubscribe to restore full access.')
                  : (billingStatus?.planStatus === 'past_due'
                    ? 'Payment is past due. Please ask your workspace admin to update billing details.'
                    : 'The subscription has been cancelled. Please ask your workspace admin to resubscribe.')}
              </div>
              {isAdmin && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.location.href = '/settings'}
                >
                  {billingStatus?.planStatus === 'past_due' ? 'Fix billing' : 'Resubscribe'}
                </Button>
              )}
            </div>
          )}
          <main className="flex-1 overflow-auto p-4 sm:p-6 bg-background min-w-0">
            <Router />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AppContent() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const [location] = useLocation();
  const [previewingPortal, setPreviewingPortal] = useState(false);

  // Public routes — always accessible regardless of auth state
  if (location === "/forgot-password") return <ForgotPasswordPage />;
  if (location.startsWith("/reset-password")) return <ResetPasswordPage />;
  if (location === "/signup") return <SignUpPage />;
  if (location === "/login") return <LoginPage />;
  if (location.startsWith("/invite/")) return <InviteAcceptPage />;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <h2 className="text-lg font-semibold mb-2">Loading...</h2>
          <p className="text-muted-foreground">Checking authentication status</p>
        </div>
      </div>
    );
  }

  // Unauthenticated visitors see the public landing page at "/"
  if (!isAuthenticated && location === "/") return <LandingPage />;

  // Any other unauthenticated deep-link goes to login
  if (!isAuthenticated) return <LoginPage />;

  if (isAuthenticated) {
    // Elevated roles (admin, designer, project_manager) always stay in the admin view.
    // The client portal is only shown automatically for pure client accounts,
    // or when an elevated user explicitly previews it.
    //
    // IMPORTANT: when a super-admin is impersonating, always render AuthenticatedApp
    // regardless of the impersonated user's role so the impersonation banner and
    // "Exit impersonation" control are always visible and reachable.
    const isElevated = ELEVATED_ROLES.includes(user?.role || '');
    const isImpersonating = !!user?._impersonating;

    if (!isImpersonating && previewingPortal && isElevated) {
      return <ClientPortalApp previewMode onExitPreview={() => setPreviewingPortal(false)} />;
    }

    // Super-admins always use AuthenticatedApp regardless of business role,
    // so /superadmin remains accessible even when their role is set to 'client'.
    if (!isImpersonating && !isElevated && user?.role === 'client' && !user?.isSuperAdmin) {
      return <ClientPortalApp />;
    }

    // Show onboarding wizard for admin users who haven't completed it yet
    const showOnboarding =
      user?.role === 'admin' &&
      user?.orgId &&
      !user?.onboardingCompletedAt;

    return (
      <>
        <AuthenticatedApp onPreviewClientPortal={() => setPreviewingPortal(true)} />
        {showOnboarding && (
          <OnboardingWizard orgId={user.orgId!} />
        )}
      </>
    );
  } else {
    return <LoginPage />;
  }
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AppContent />
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
