import { useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Building2, Users, CheckCircle, ArrowRight, Mail, X } from "lucide-react";

interface OnboardingWizardProps {
  orgId: string;
}

const step1Schema = z.object({
  companyName: z.string().min(2, "Company name must be at least 2 characters"),
});

const inviteSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  role: z.enum(["admin", "designer", "project_manager", "client"]),
});

type Step1Values = z.infer<typeof step1Schema>;
type InviteValues = z.infer<typeof inviteSchema>;

export default function OnboardingWizard({ orgId }: OnboardingWizardProps) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [isSavingName, setIsSavingName] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [inviteSent, setInviteSent] = useState(false);
  const [isCompleting, setIsCompleting] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const step1Form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { companyName: "" },
  });

  // Fetch the real org name and prefill step 1
  useEffect(() => {
    if (!orgId) return;
    fetch(`/api/organisations/${orgId}`, { credentials: "include" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data?.name) {
          step1Form.setValue("companyName", data.name);
        }
      })
      .catch(() => {});
  }, [orgId]);

  // Auto-complete on mount so the wizard never blocks an existing user.
  // If the org already exists (orgId is set) this is a no-op for new users
  // but immediately marks completion for users who should never have seen it.
  useEffect(() => {
    apiRequest("POST", "/api/auth/complete-onboarding")
      .then(() => queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] }))
      .catch(() => {});
  }, []);

  const inviteForm = useForm<InviteValues>({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: "", role: "designer" },
  });

  async function handleSaveName(values: Step1Values) {
    if (!orgId) { setStep(2); return; }
    setIsSavingName(true);
    try {
      await apiRequest("PATCH", `/api/organisations/${orgId}`, { name: values.companyName });
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      // non-fatal — continue
    } finally {
      setIsSavingName(false);
      setStep(2);
    }
  }

  async function handleSendInvite(values: InviteValues) {
    setIsInviting(true);
    try {
      await apiRequest("POST", "/api/invitations", { email: values.email, role: values.role });
      setInviteSent(true);
      toast({ title: "Invitation sent", description: `An invite email has been sent to ${values.email}.` });
    } catch (err: any) {
      toast({ title: "Could not send invitation", description: err.message, variant: "destructive" });
    } finally {
      setIsInviting(false);
    }
  }

  async function handleComplete() {
    setIsCompleting(true);
    try {
      await apiRequest("POST", "/api/auth/complete-onboarding");
      await queryClient.invalidateQueries({ queryKey: ["/api/auth/user"] });
    } catch {
      // best-effort
    } finally {
      setIsCompleting(false);
      setDismissed(true);
    }
  }

  // Already auto-completed or user dismissed — render nothing
  if (dismissed) return null;

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg relative">
        {/* Always-visible close button — marks onboarding complete and dismisses */}
        <button
          onClick={handleComplete}
          className="absolute top-4 right-4 p-1 rounded-md text-muted-foreground hover-elevate z-10"
          title="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Progress indicator */}
        <div className="flex gap-1 px-6 pt-6">
          {[1, 2].map((s) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${s <= step ? "bg-primary" : "bg-muted"}`}
            />
          ))}
        </div>

        {step === 1 && (
          <>
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 1 of 2</span>
              </div>
              <CardTitle>Welcome to Pixelcraft Designs!</CardTitle>
              <CardDescription>
                Let's confirm your workspace name. You can always change it later in Settings.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Form {...step1Form}>
                <form onSubmit={step1Form.handleSubmit(handleSaveName)} className="space-y-4">
                  <FormField
                    control={step1Form.control}
                    name="companyName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Company / studio name</FormLabel>
                        <FormControl>
                          <Input placeholder="Acme Interiors" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="flex gap-2 pt-2">
                    <Button type="submit" className="flex-1" disabled={isSavingName}>
                      {isSavingName ? "Saving…" : (
                        <>Continue <ArrowRight className="h-4 w-4 ml-2" /></>
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
            </CardContent>
          </>
        )}

        {step === 2 && (
          <>
            <CardHeader className="space-y-2">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Step 2 of 2</span>
              </div>
              <CardTitle>Invite your team</CardTitle>
              <CardDescription>
                Add a colleague to get started. You can invite more people later from Settings.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {!inviteSent ? (
                <Form {...inviteForm}>
                  <form onSubmit={inviteForm.handleSubmit(handleSendInvite)} className="space-y-4">
                    <FormField
                      control={inviteForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email address</FormLabel>
                          <FormControl>
                            <Input type="email" placeholder="colleague@yourcompany.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={inviteForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} value={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Admin — full access</SelectItem>
                              <SelectItem value="designer">Designer — manage content</SelectItem>
                              <SelectItem value="project_manager">Project Manager — assigned projects</SelectItem>
                              <SelectItem value="client">Client — read-only portal</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex gap-2 pt-2">
                      <Button type="submit" className="flex-1" disabled={isInviting}>
                        {isInviting ? "Sending…" : (
                          <><Mail className="h-4 w-4 mr-2" />Send invitation</>
                        )}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={handleComplete}
                        disabled={isCompleting}
                      >
                        {isCompleting ? "…" : "Skip"}
                      </Button>
                    </div>
                  </form>
                </Form>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-start gap-3 p-4 rounded-md border bg-muted/40">
                    <CheckCircle className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                    <div>
                      <p className="font-medium text-sm">Invitation sent!</p>
                      <p className="text-sm text-muted-foreground">
                        They'll receive an email with a link to create their account.
                      </p>
                    </div>
                  </div>
                  <Button className="w-full" onClick={handleComplete} disabled={isCompleting}>
                    {isCompleting ? "Finishing…" : (
                      <><CheckCircle className="h-4 w-4 mr-2" />Finish setup</>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </>
        )}
      </Card>
    </div>
  );
}
