import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { Eye, EyeOff, UserCheck, AlertTriangle, Loader2, LogIn } from "lucide-react";

const newAccountSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine(d => d.password === d.confirmPassword, {
  message: "Passwords do not match",
  path: ["confirmPassword"],
});

type NewAccountValues = z.infer<typeof newAccountSchema>;

interface InviteDetails {
  email: string;
  role: string;
  orgName: string;
  invitedBy: string;
  accountExists: boolean;
}

export default function InviteAcceptPage() {
  const [location, navigate] = useLocation();
  const token = location.startsWith("/invite/") ? location.slice("/invite/".length) : undefined;
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [inviteDetails, setInviteDetails] = useState<InviteDetails | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [fetchingInvite, setFetchingInvite] = useState(true);

  const form = useForm<NewAccountValues>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { firstName: "", lastName: "", password: "", confirmPassword: "" },
  });

  useEffect(() => {
    if (!token) return;
    fetch(`/api/invitations/token/${token}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Invalid invitation");
        setInviteDetails(data);
      })
      .catch((err) => setInviteError(err.message))
      .finally(() => setFetchingInvite(false));
  }, [token]);

  async function acceptAsExistingUser() {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/invitations/token/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ password: "existing-account-placeholder" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to join workspace");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: `You've joined ${inviteDetails?.orgName}.` });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Failed to join workspace", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  async function handleNewAccountSubmit(values: NewAccountValues) {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/invitations/token/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          firstName: values.firstName,
          lastName: values.lastName,
          password: values.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to accept invitation");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
      toast({ title: "Welcome!", description: "Your account has been created." });
      navigate("/");
    } catch (err: any) {
      toast({ title: "Failed to accept invitation", description: err.message, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  if (fetchingInvite) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (inviteError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md text-center">
          <CardHeader className="space-y-3 pb-4">
            <div className="flex justify-center">
              <div className="h-14 w-14 rounded-full bg-destructive/10 flex items-center justify-center">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
            </div>
            <CardTitle>Invalid invitation</CardTitle>
            <CardDescription>{inviteError}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="w-full" onClick={() => navigate("/")}>
              Go to sign in
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-3 pb-4">
          <div className="flex justify-center">
            <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center">
              <UserCheck className="h-7 w-7 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">
            {inviteDetails?.accountExists ? "Join workspace" : "Accept invitation"}
          </CardTitle>
          <CardDescription>
            You've been invited to join <strong>{inviteDetails?.orgName}</strong> as a{" "}
            <Badge variant="default" className="text-xs">{inviteDetails?.role}</Badge>
          </CardDescription>
          {inviteDetails && (
            <p className="text-sm text-muted-foreground">
              Joining as <strong>{inviteDetails.email}</strong>
            </p>
          )}
        </CardHeader>

        <CardContent>
          {inviteDetails?.accountExists ? (
            /* Existing account — just link to org, no new password needed */
            <div className="space-y-4">
              <p className="text-sm text-center text-muted-foreground">
                You already have an Olympik Design account. Click below to join{" "}
                <strong>{inviteDetails.orgName}</strong> using your existing account.
              </p>
              <Button className="w-full" onClick={acceptAsExistingUser} disabled={isLoading}>
                {isLoading ? (
                  <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Joining…</>
                ) : (
                  <><LogIn className="h-4 w-4 mr-2" />Join {inviteDetails.orgName}</>
                )}
              </Button>
              <p className="text-xs text-center text-muted-foreground">
                Not you?{" "}
                <button
                  type="button"
                  onClick={() => navigate("/login")}
                  className="underline hover:text-foreground"
                >
                  Sign in with a different account
                </button>
              </p>
            </div>
          ) : (
            /* New account — collect name + password */
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleNewAccountSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>First name</FormLabel>
                        <FormControl>
                          <Input placeholder="Jane" autoComplete="given-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Last name</FormLabel>
                        <FormControl>
                          <Input placeholder="Smith" autoComplete="family-name" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

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
                            placeholder="At least 8 characters"
                            autoComplete="new-password"
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

                <FormField
                  control={form.control}
                  name="confirmPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Confirm password</FormLabel>
                      <FormControl>
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="Repeat your password"
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? (
                    <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Creating account…</>
                  ) : "Create account & join"}
                </Button>
              </form>
            </Form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
