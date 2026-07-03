import { useState, useEffect } from "react";
import { useParams, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, LogIn, Building2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(1, "Password is required"),
});

type LoginValues = z.infer<typeof loginSchema>;

export default function OrgEntryPage() {
  const { slug } = useParams<{ slug: string }>();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [orgName, setOrgName] = useState<string | null>(null);
  const [orgId, setOrgId] = useState<string | null>(null);
  const [orgNotFound, setOrgNotFound] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const form = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });

  // Step 1: fetch org info by slug
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/orgs/by-slug/${encodeURIComponent(slug)}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setOrgNotFound(true); return; }
        setOrgName(data.name);
        setOrgId(data.id);
      })
      .catch(() => setOrgNotFound(true));
  }, [slug]);

  // Step 2: once org + auth state are known, decide what to show
  useEffect(() => {
    if (!orgId || authLoading) return;

    if (!isAuthenticated) {
      // Not logged in — show login form
      setShowForm(true);
      return;
    }

    // Logged in — check if they're in the right org
    if ((user as any)?.orgId === orgId) {
      // Already in the correct org — go straight to dashboard
      navigate("/");
    } else {
      // Wrong org — log out first, then show login form
      setIsLoggingOut(true);
      fetch("/api/auth/logout", { method: "POST", credentials: "include" })
        .finally(() => {
          queryClient.clear();
          setIsLoggingOut(false);
          setShowForm(true);
        });
    }
  }, [orgId, isAuthenticated, authLoading, user, navigate]);

  async function handleLogin(values: LoginValues) {
    setIsLoggingIn(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");

      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Sign in failed", description: err.message, variant: "destructive" });
    } finally {
      setIsLoggingIn(false);
    }
  }

  if (orgNotFound) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardContent className="pt-8 pb-6 space-y-3">
            <Building2 className="h-10 w-10 mx-auto text-muted-foreground" />
            <p className="font-medium">Workspace not found</p>
            <p className="text-sm text-muted-foreground">The link <code className="text-xs bg-muted px-1 py-0.5 rounded">{slug}</code> doesn't match any workspace.</p>
            <Button variant="outline" onClick={() => navigate("/login")} className="mt-2">Go to login</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isReady = orgName && (showForm || isLoggingOut);

  if (!isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-2">
          <Logo className="h-10 w-10 text-primary mx-auto" />
          <p className="text-sm text-muted-foreground">
            {isLoggingOut ? "Switching workspace…" : "Loading…"}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <Logo className="h-14 w-14 text-primary" />
          </div>
          <CardTitle className="text-2xl">Pixelcraft Designs</CardTitle>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Building2 className="h-4 w-4 shrink-0" />
            <span>Signing into <span className="font-medium text-foreground">{orgName}</span></span>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleLogin)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email address</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" autoComplete="email" autoFocus {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Your password"
                          autoComplete="current-password"
                          {...field}
                        />
                        <button
                          type="button"
                          tabIndex={-1}
                          onClick={() => setShowPassword(v => !v)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate("/forgot-password")}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:underline underline-offset-4"
                >
                  Forgot password?
                </button>
              </div>
              <Button type="submit" className="w-full" disabled={isLoggingIn}>
                {isLoggingIn ? "Signing in…" : (
                  <>
                    <LogIn className="h-4 w-4 mr-2" />
                    Sign in to {orgName}
                  </>
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
