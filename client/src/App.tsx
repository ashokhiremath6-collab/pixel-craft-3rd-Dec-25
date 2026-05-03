import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import ThemeToggle from "@/components/ThemeToggle";
import NotFound from "@/pages/not-found";
import DashboardPage from "@/pages/DashboardPage";
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
import ForgotPasswordPage from "@/pages/ForgotPasswordPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { LogOut, Shield, User, Crown } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
      <Route component={NotFound} />
    </Switch>
  );
}

function AuthenticatedApp() {
  const { logout, user } = useAuth();

  const style = {
    "--sidebar-width": "14rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full overflow-hidden">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-2 sm:p-4 border-b bg-background shrink-0 gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0">
              <SidebarTrigger data-testid="button-sidebar-toggle" />
              <div className="flex items-center gap-2 min-w-0">
                <img src="/logo.png" alt="PixelCraft Designer" className="h-7 w-7 object-contain shrink-0" />
                <h1 className="text-sm sm:text-base font-semibold truncate hidden sm:block" data-testid="heading-app-title">
                  PixelCraft Designer
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

  if (location === "/forgot-password") return <ForgotPasswordPage />;
  if (location.startsWith("/reset-password")) return <ResetPasswordPage />;

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

  if (isAuthenticated) {
    if (user?.role === 'client') {
      return <ClientPortalApp />;
    }
    return <AuthenticatedApp />;
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
