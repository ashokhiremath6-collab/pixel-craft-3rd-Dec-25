import { useState, useEffect } from "react";
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
import { Mail, Send, FileText, FolderOpen } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Vendor } from "@shared/schema";

interface QuoteTemplate { id: string; name: string; categoryId: string; }
interface Project { id: string; project_name?: string; name?: string; }
interface VendorCategory { id: string; name: string; children?: VendorCategory[]; }

const schema = z.object({
  email: z.string().email("Please enter a valid email address"),
  projectId: z.string().min(1, "Please select a project"),
  categoryId: z.string().optional(),
  inviteMessage: z.string().optional(),
  quoteTemplateId: z.string().optional(),
});
type FormValues = z.infer<typeof schema>;

interface Props {
  vendor: Vendor;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

function flattenCategories(cats: VendorCategory[]): VendorCategory[] {
  return cats.flatMap(c => [{ id: c.id, name: c.name }, ...flattenCategories(c.children ?? [])]);
}

export default function InviteVendorDialog({ vendor, open, onOpenChange }: Props) {
  const { toast } = useToast();

  const { data: templates } = useQuery<QuoteTemplate[]>({
    queryKey: ["/api/quote-templates"],
    enabled: open,
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
    enabled: open,
  });

  const { data: categoryTree = [] } = useQuery<VendorCategory[]>({
    queryKey: ["/api/vendor-categories/tree"],
    enabled: open,
  });

  const allCategories = flattenCategories(categoryTree);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      email: vendor.email || "",
      projectId: "",
      categoryId: (vendor as any).categoryId || "",
      inviteMessage: "",
      quoteTemplateId: "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        email: vendor.email || "",
        projectId: "",
        categoryId: (vendor as any).categoryId || "",
        inviteMessage: "",
        quoteTemplateId: "",
      });
    }
  }, [open, vendor]);

  const inviteMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      const selectedCategory = allCategories.find(c => c.id === values.categoryId);

      await apiRequest("POST", "/api/invitations", {
        email: values.email,
        role: "vendor",
        linkedVendorId: vendor.id,
        inviteMessage: values.inviteMessage || undefined,
        quoteTemplateId: values.quoteTemplateId || undefined,
      });

      await apiRequest("POST", "/api/project-vendors/upsert", {
        projectId: values.projectId,
        vendorId: vendor.id,
        categoryId: values.categoryId || null,
        category: selectedCategory?.name || null,
        quotationName: "Main Quote",
        quotationType: "item",
        status: "Quoted",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invitations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/quotations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/vendors-with-projects"] });
      toast({
        title: "RFQ sent",
        description: `Invitation sent to ${form.getValues("email")} and quote slot created.`,
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
            toast({ title: "Could not send RFQ", description: parsed.error, variant: "destructive" });
            return;
          }
        } catch { /* fall through */ }
      }
      toast({ title: "Could not send RFQ", description: error.message, variant: "destructive" });
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
            Send RFQ to vendor
          </DialogTitle>
          <DialogDescription>
            Invite <strong>{vendor.name}</strong> to submit a quote through the vendor portal. Select which project and category this quote is for.
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">

            <div className="grid grid-cols-2 gap-3">
              <FormField
                control={form.control}
                name="projectId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Project</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <FolderOpen className="h-4 w-4 mr-2 text-muted-foreground" />
                          <SelectValue placeholder="Select project" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {projects.map((p: any) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.projectName ?? p.project_name ?? p.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Category
                      <Badge variant="secondary" className="ml-2 text-xs">Optional</Badge>
                    </FormLabel>
                    <Select onValueChange={field.onChange} value={field.value ?? ""}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {allCategories.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

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
                      placeholder="Describe what you'd like them to quote — scope of work, materials, timelines, etc."
                      className="resize-none min-h-[90px]"
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
              <Button type="submit" disabled={inviteMutation.isPending || !form.watch("projectId")}>
                {inviteMutation.isPending ? "Sending…" : (
                  <><Send className="h-4 w-4 mr-2" />Send RFQ</>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
