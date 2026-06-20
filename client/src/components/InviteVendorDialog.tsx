import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Mail, Send, FileText } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vendor } from "@shared/schema";

interface QuoteTemplate {
  id: string;
  name: string;
  categoryId: string;
}

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  inviteMessage: z.string().optional(),
  quoteTemplateId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function InviteVendorDialog({ vendor, open, onOpenChange }: Props) {
  const { toast } = useToast();

  const { data: templates } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates"],
    enabled: open,
  });

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: vendor.email || "",
      inviteMessage: "",
      quoteTemplateId: "",
    },
  });

  const inviteMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      return apiRequest("POST", "/api/invitations", {
        email: values.email,
        role: "vendor",
        linkedVendorId: vendor.id,
        inviteMessage: values.inviteMessage || undefined,
        quoteTemplateId: values.quoteTemplateId || undefined,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      toast({
        title: "Quote request sent",
        description: `An invitation has been sent to ${form.getValues("email")}.`,
      });
      form.reset();
      onOpenChange(false);
    },
    onError: (error: Error) => {
      const raw = error.message ?? "";
      const jsonStart = raw.indexOf("{");
      if (jsonStart !== -1) {
        try {
          const parsed = JSON.parse(raw.slice(jsonStart));
          if (parsed.error) {
            toast({ title: "Could not send invitation", description: parsed.error, variant: "destructive" });
            return;
          }
        } catch { /* fall through */ }
      }
      toast({ title: "Could not send invitation", description: error.message, variant: "destructive" });
    },
  });

  const onSubmit = (values: FormValues) => {
    inviteMutation.mutate(values);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Invite vendor to portal
          </DialogTitle>
          <DialogDescription>
            Send <strong>{vendor.name}</strong> an invitation to set up their vendor account and submit quotes directly through the app.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email address</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input className="pl-9" placeholder="vendor@company.com" {...field} />
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="inviteMessage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Quote request details
                    <Badge variant="secondary" className="ml-2 text-xs">Optional</Badge>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Describe what you'd like them to quote — scope of work, materials, timelines, etc. This message will appear in the invitation email."
                      className="resize-none min-h-[100px]"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {templates && templates.length > 0 && (
              <FormField
                control={form.control}
                name="quoteTemplateId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Attach quote template
                      <Badge variant="secondary" className="ml-2 text-xs">Optional</Badge>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Select a template to reference" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <DialogFooter className="gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={inviteMutation.isPending}>
                {inviteMutation.isPending ? "Sending…" : (
                  <><Send className="h-4 w-4 mr-2" />Send invitation</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
