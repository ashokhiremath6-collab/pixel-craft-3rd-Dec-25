import { useState, useRef, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList, Plus, Pencil, Trash2, Eye, FileText,
  User, Mail, Phone, MapPin, DollarSign, Calendar, Send,
  CheckCircle, XCircle, ChevronDown, ChevronUp, X
} from "lucide-react";
import type { ClientBrief, Proposal, Project } from "@shared/schema";
import { format } from "date-fns";
import { useAuth } from "@/hooks/useAuth";
import { useLocation } from "wouter";

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProposalDeliverable {
  id: string;
  title: string;
}

interface ProposalPhase {
  id: string;
  name: string;
  description: string;
  fee: number;
  timeline: string;
  deliverables: ProposalDeliverable[];
}

// ─── Constants ────────────────────────────────────────────────────────────────
const PROJECT_TYPES = ["Residential", "Commercial", "Hospitality", "Retail", "Office", "Healthcare", "Educational", "Other"];
const ROOM_OPTIONS = ["Living room", "Dining area", "Kitchen", "Master bedroom", "Bedroom", "Bathroom / en-suite", "Powder room", "Study / office", "Children's room", "Terrace / balcony", "Laundry / utility", "Pooja room"];
const WORK_TYPES = ["New construction", "Renovation", "Furnishing only", "Partial renovation"];
const STYLE_OPTIONS = ["Minimalist", "Contemporary", "Transitional", "Modern classic", "Maximalist", "Japandi", "Industrial", "Traditional / ethnic", "Eclectic", "Biophilic"];
const BRIEF_STATUSES: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "New", variant: "secondary" },
  in_progress: { label: "In Progress", variant: "default" },
  proposal_sent: { label: "Proposal Sent", variant: "outline" },
  converted: { label: "Converted", variant: "default" },
};
const PROPOSAL_STATUSES: Record<string, { label: string; color: string }> = {
  draft: { label: "Draft", color: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", color: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" },
  accepted: { label: "Accepted", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" },
  rejected: { label: "Rejected", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300" },
};

const DEFAULT_PHASES: ProposalPhase[] = [
  { id: crypto.randomUUID(), name: "Concept Design", description: "Initial space planning, mood boards, material palette and 3D concept renders.", fee: 0, timeline: "3–4 weeks", deliverables: [{ id: crypto.randomUUID(), title: "Floor plan layouts" }, { id: crypto.randomUUID(), title: "Mood boards" }, { id: crypto.randomUUID(), title: "Material & finish schedule" }, { id: crypto.randomUUID(), title: "3D concept renders" }] },
  { id: crypto.randomUUID(), name: "Design Development", description: "Detailed drawings, BOQ, vendor shortlisting and technical specifications.", fee: 0, timeline: "4–5 weeks", deliverables: [{ id: crypto.randomUUID(), title: "Detailed floor & ceiling plans" }, { id: crypto.randomUUID(), title: "Elevation drawings" }, { id: crypto.randomUUID(), title: "BOQ and vendor quotes" }, { id: crypto.randomUUID(), title: "FF&E specifications" }] },
  { id: crypto.randomUUID(), name: "Working Drawings", description: "Construction-ready drawings and technical details for execution.", fee: 0, timeline: "3–4 weeks", deliverables: [{ id: crypto.randomUUID(), title: "Construction drawings" }, { id: crypto.randomUUID(), title: "Electrical & plumbing layouts" }, { id: crypto.randomUUID(), title: "Joinery details" }] },
  { id: crypto.randomUUID(), name: "Execution & Supervision", description: "On-site supervision, vendor coordination and quality control through to handover.", fee: 0, timeline: "Ongoing during execution", deliverables: [{ id: crypto.randomUUID(), title: "Site visits" }, { id: crypto.randomUUID(), title: "Vendor coordination" }, { id: crypto.randomUUID(), title: "Quality sign-off at handover" }] },
];

const DEFAULT_PAYMENT_SCHEDULE = `30% — On signing of contract
30% — On concept design approval
20% — On working drawings delivery
20% — On project handover`;

const DEFAULT_TERMS = `1. The design fee does not include the cost of materials, furniture, fixtures, or construction.
2. The scope of work is limited to the areas described in this proposal. Any additional spaces will be quoted separately.
3. A maximum of two rounds of revisions are included per phase. Additional rounds will be charged at the hourly rate.
4. This proposal is valid for ${30} days from the date of issue.
5. All intellectual property in the designs remains with the studio until full payment is received.`;

function fmt(amount: number | string | null | undefined, currency = "INR") {
  const n = Number(amount) || 0;
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(n);
}

// ─── Brief Form Schema ────────────────────────────────────────────────────────
const briefFormSchema = z.object({
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").or(z.literal("")).optional(),
  phone: z.string().optional(),
  projectType: z.string().optional(),
  propertyAddress: z.string().optional(),
  scopeOfWork: z.string().optional(),
  budgetMin: z.string().optional(),
  budgetMax: z.string().optional(),
  currency: z.string().default("INR"),
  timeline: z.string().optional(),
  stylePreferences: z.string().optional(),
  mustHaves: z.string().optional(),
  mustAvoids: z.string().optional(),
  inspirationNotes: z.string().optional(),
  status: z.string().default("new"),
  projectId: z.string().optional(),
});
type BriefFormValues = z.infer<typeof briefFormSchema>;

// ─── Proposal top-level Form Schema ──────────────────────────────────────────
const proposalFormSchema = z.object({
  proposalTitle: z.string().min(1, "Title is required"),
  clientName: z.string().min(1, "Client name is required"),
  clientEmail: z.string().email("Invalid email").or(z.literal("")).optional(),
  feeStructure: z.string().default("flat_fee"),
  percentageRate: z.string().optional(),
  hourlyRate: z.string().optional(),
  currency: z.string().default("INR"),
  paymentSchedule: z.string().optional(),
  termsAndConditions: z.string().optional(),
  validityDays: z.number().default(30),
  status: z.string().default("draft"),
  briefId: z.string().optional(),
  projectId: z.string().optional(),
});
type ProposalFormValues = z.infer<typeof proposalFormSchema>;

// ─── Brief Sheet ──────────────────────────────────────────────────────────────
function PillToggle({ label, selected, onToggle }: { label: string; selected: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={[
        "px-3 py-1 rounded-full text-sm border transition-colors",
        selected
          ? "bg-primary text-primary-foreground border-primary"
          : "bg-background text-foreground border-border hover-elevate",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function BriefSheet({ open, onClose, brief, projects }: {
  open: boolean;
  onClose: () => void;
  brief?: ClientBrief | null;
  projects: Project[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!brief;
  const fileInputRef = useRef<HTMLInputElement>(null);

  // File upload state
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [removedPaths, setRemovedPaths] = useState<Set<string>>(new Set());

  // Questionnaire quick-select state
  const [isEntireFlat, setIsEntireFlat] = useState<boolean>(true);
  const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set());
  const [workType, setWorkType] = useState<string>("");
  const [bedroomCount, setBedroomCount] = useState<string>("");
  const [childBedroomCount, setChildBedroomCount] = useState<string>("");
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());

  // Timeline — client's preferred start date
  const [clientStart, setClientStart] = useState<string>("");

  const existingRefs = useMemo(
    () => ((brief?.referenceFiles as any[]) || []).filter((f: any) => !removedPaths.has(f.path)),
    [brief?.referenceFiles, removedPaths]
  );

  const form = useForm<BriefFormValues>({
    resolver: zodResolver(briefFormSchema),
    defaultValues: {
      clientName: brief?.clientName ?? "",
      clientEmail: brief?.clientEmail ?? "",
      phone: brief?.phone ?? "",
      projectType: brief?.projectType ?? "",
      propertyAddress: brief?.propertyAddress ?? "",
      scopeOfWork: brief?.scopeOfWork ?? "",
      budgetMin: brief?.budgetMin?.toString() ?? "",
      budgetMax: brief?.budgetMax?.toString() ?? "",
      currency: brief?.currency ?? "INR",
      timeline: brief?.timeline ?? "",
      stylePreferences: brief?.stylePreferences ?? "",
      mustHaves: brief?.mustHaves ?? "",
      mustAvoids: brief?.mustAvoids ?? "",
      inspirationNotes: brief?.inspirationNotes ?? "",
      status: brief?.status ?? "new",
      projectId: brief?.projectId ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        clientName: brief?.clientName ?? "",
        clientEmail: brief?.clientEmail ?? "",
        phone: brief?.phone ?? "",
        projectType: brief?.projectType ?? "",
        propertyAddress: brief?.propertyAddress ?? "",
        scopeOfWork: brief?.scopeOfWork ?? "",
        budgetMin: brief?.budgetMin?.toString() ?? "",
        budgetMax: brief?.budgetMax?.toString() ?? "",
        currency: brief?.currency ?? "INR",
        timeline: brief?.timeline ?? "",
        stylePreferences: brief?.stylePreferences ?? "",
        mustHaves: brief?.mustHaves ?? "",
        mustAvoids: brief?.mustAvoids ?? "",
        inspirationNotes: brief?.inspirationNotes ?? "",
        status: brief?.status ?? "new",
        projectId: brief?.projectId ?? "",
      });
      setPendingFiles([]);
      setRemovedPaths(new Set());
      setIsEntireFlat(true);
      setSelectedRooms(new Set());
      setWorkType("");
      setBedroomCount("");
      setChildBedroomCount("");
      setSelectedStyles(new Set());
      setClientStart(brief?.timeline ?? "");
    }
  }, [open, brief?.id]);

  function toggleRoom(r: string) {
    setSelectedRooms(prev => { const n = new Set(prev); n.has(r) ? n.delete(r) : n.add(r); return n; });
  }
  function toggleStyle(s: string) {
    setSelectedStyles(prev => { const n = new Set(prev); n.has(s) ? n.delete(s) : n.add(s); return n; });
  }

  const mutation = useMutation({
    mutationFn: async (data: BriefFormValues) => {
      // Compose quick-select choices into the text fields
      const scopeParts: string[] = [];
      scopeParts.push(isEntireFlat ? "Scope: Entire flat" : "Scope: Specific rooms");
      if (workType) scopeParts.push(`Work type: ${workType}`);
      if (selectedRooms.size > 0) scopeParts.push(`Rooms: ${Array.from(selectedRooms).join(", ")}`);
      if (bedroomCount.trim()) scopeParts.push(`Bedrooms: ${bedroomCount.trim()}`);
      if (childBedroomCount.trim()) scopeParts.push(`Children's bedrooms: ${childBedroomCount.trim()}`);
      if (data.scopeOfWork?.trim()) scopeParts.push(data.scopeOfWork.trim());

      const styleParts: string[] = [];
      if (selectedStyles.size > 0) styleParts.push(`Style direction: ${Array.from(selectedStyles).join(", ")}`);
      if (data.stylePreferences?.trim()) styleParts.push(data.stylePreferences.trim());

      const timelineParts: string[] = [];
      if (clientStart.trim()) timelineParts.push(clientStart.trim());

      const keepRefs = ((brief?.referenceFiles as any[]) || []).filter((f: any) => !removedPaths.has(f.path));
      const payload = {
        ...data,
        scopeOfWork: scopeParts.join("\n") || null,
        stylePreferences: styleParts.join("\n") || null,
        timeline: timelineParts.join("\n") || null,
        projectId: data.projectId || null,
        clientEmail: data.clientEmail || null,
        referenceFiles: keepRefs,
      };

      let savedId: string;
      if (isEdit) {
        const r = await apiRequest("PUT", `/api/client-briefs/${brief!.id}`, payload);
        savedId = (await r.json()).id;
      } else {
        const r = await apiRequest("POST", "/api/client-briefs", payload);
        savedId = (await r.json()).id;
      }
      if (pendingFiles.length > 0) {
        const fd = new FormData();
        pendingFiles.forEach(f => fd.append('files', f));
        await fetch(`/api/client-briefs/${savedId}/references`, { method: 'POST', body: fd, credentials: 'include' });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/client-briefs"] });
      toast({ title: isEdit ? "Brief updated" : "Brief saved" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not save brief", variant: "destructive" }),
  });

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    if (!e.target.files) return;
    setPendingFiles(prev => [...prev, ...Array.from(e.target.files!)]);
    e.target.value = '';
  }

  function Q({ number, label, hint }: { number: number; label: string; hint?: string }) {
    return (
      <div className="flex items-baseline gap-2.5 mb-3">
        <span className="text-xs font-bold text-muted-foreground/60 w-5 shrink-0 text-right">{number}</span>
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          {hint && <p className="text-xs text-muted-foreground mt-0.5">{hint}</p>}
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader className="mb-6">
          <SheetTitle>{isEdit ? "Edit Client Brief" : "New Client Brief"}</SheetTitle>
          <p className="text-sm text-muted-foreground mt-1">Answer what you can — every answer helps shape the design.</p>
        </SheetHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-7">

            {/* ── Section A: About the client ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">A — About the client</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Client name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="phone" render={({ field }) => (
                  <FormItem><FormLabel>Phone</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel>Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="projectType" render={({ field }) => (
                  <FormItem><FormLabel>Project type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger></FormControl>
                      <SelectContent>{PROJECT_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
              <FormField control={form.control} name="propertyAddress" render={({ field }) => (
                <FormItem><FormLabel>Property address</FormLabel><FormControl><Input placeholder="City / locality is fine if full address is not yet known" {...field} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>

            <Separator />

            {/* ── Section B: Scope ── */}
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">B — Scope of work</p>

              {/* Q1 — scope toggle + room list */}
              <div className="space-y-3">
                <Q number={1} label="Is the scope the entire flat?" />
                <div className="flex flex-wrap gap-2">
                  <PillToggle label="Entire flat" selected={isEntireFlat} onToggle={() => setIsEntireFlat(true)} />
                  <PillToggle label="Specific rooms only" selected={!isEntireFlat} onToggle={() => setIsEntireFlat(false)} />
                </div>
                <p className="text-xs text-muted-foreground">
                  {isEntireFlat ? "Which rooms does the flat include? Select all that apply." : "Which rooms are in scope? Select all that apply."}
                </p>
                <div className="flex flex-wrap gap-2">
                  {ROOM_OPTIONS.map(r => (
                    <PillToggle key={r} label={r} selected={selectedRooms.has(r)} onToggle={() => toggleRoom(r)} />
                  ))}
                </div>
              </div>

              <div>
                <Q number={2} label="What type of work is required?" />
                <div className="flex flex-wrap gap-2">
                  {WORK_TYPES.map(w => (
                    <PillToggle key={w} label={w} selected={workType === w} onToggle={() => setWorkType(prev => prev === w ? "" : w)} />
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Q number={3} label="How many bedrooms?" />
                  <Input
                    type="number"
                    min={1}
                    value={bedroomCount}
                    onChange={e => setBedroomCount(e.target.value)}
                    placeholder="e.g. 5"
                  />
                </div>
                <div>
                  <Q number={4} label="How many children's bedrooms?" />
                  <Input
                    type="number"
                    min={0}
                    value={childBedroomCount}
                    onChange={e => setChildBedroomCount(e.target.value)}
                    placeholder="e.g. 2"
                  />
                </div>
              </div>

              <FormField control={form.control} name="scopeOfWork" render={({ field }) => (
                <FormItem>
                  <Q number={5} label="Any additional scope details?" hint="Size of the home, special requirements, specific rooms not listed above, etc." />
                  <FormControl><Textarea rows={3} placeholder="e.g. 2,800 sq ft 3-BHK. False ceiling, AV integration, and custom joinery throughout." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            {/* ── Section C: Design direction ── */}
            <div className="space-y-5">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">C — Design direction</p>

              <div>
                <Q number={6} label="Which style directions resonate with the client?" hint="Select one or more" />
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map(s => (
                    <PillToggle key={s} label={s} selected={selectedStyles.has(s)} onToggle={() => toggleStyle(s)} />
                  ))}
                </div>
              </div>

              <FormField control={form.control} name="stylePreferences" render={({ field }) => (
                <FormItem>
                  <Q number={7} label="Describe the feel in your own words" hint="Materials, colours, mood, lighting preferences — anything goes." />
                  <FormControl><Textarea rows={3} placeholder="e.g. Warm and earthy — oak veneer, sage green accents, textured plaster. Natural light is a priority. No dark or heavy elements." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="mustHaves" render={({ field }) => (
                  <FormItem>
                    <Q number={8} label="Must-haves" hint="Non-negotiables" />
                    <FormControl><Textarea rows={4} placeholder="e.g. Walk-in wardrobe, home office nook, concealed storage throughout, Italian marble in bathrooms." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mustAvoids" render={({ field }) => (
                  <FormItem>
                    <Q number={9} label="Must-avoids" hint="Things to stay away from" />
                    <FormControl><Textarea rows={4} placeholder="e.g. No dark walls, no brass, avoid heavy drapes, nothing too formal or hotel-like." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="inspirationNotes" render={({ field }) => (
                <FormItem>
                  <Q number={10} label="Inspiration sources" hint="Hotels, projects, Instagram handles, Pinterest boards, magazines — links welcome." />
                  <FormControl><Textarea rows={2} placeholder="e.g. Soho House Mumbai, Studio Lotus projects, AD India Jan 2024 cover story." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            {/* ── Section D: Budget & timeline ── */}
            <div className="space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">D — Budget & timeline</p>

              <div>
                <Q number={11} label="What is the approximate budget?" />
                <div className="grid grid-cols-3 gap-3">
                  <FormField control={form.control} name="budgetMin" render={({ field }) => (
                    <FormItem><FormLabel>Min</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="budgetMax" render={({ field }) => (
                    <FormItem><FormLabel>Max</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="currency" render={({ field }) => (
                    <FormItem><FormLabel>Currency</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="INR">INR</SelectItem>
                          <SelectItem value="USD">USD</SelectItem>
                          <SelectItem value="AED">AED</SelectItem>
                          <SelectItem value="GBP">GBP</SelectItem>
                        </SelectContent>
                      </Select><FormMessage />
                    </FormItem>
                  )} />
                </div>
              </div>

              <div>
                <Q number={12} label="When does the client want to start?" hint="Capture what the client said — even a rough indication helps." />
                <Input
                  value={clientStart}
                  onChange={e => setClientStart(e.target.value)}
                  placeholder="e.g. ASAP, March 2026, After flat handover in May"
                />
              </div>

            </div>

            <Separator />

            {/* ── Section E: Reference files ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">E — Reference files</p>
              <p className="text-sm text-muted-foreground">Upload mood boards, inspiration images, floor plans, or any supporting documents.</p>

              {(existingRefs.length > 0 || pendingFiles.length > 0) && (
                <div className="space-y-1.5">
                  {existingRefs.map((f: any) => (
                    <div key={f.path} className="flex items-center gap-2 py-1.5 px-3 rounded-md border text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setRemovedPaths(prev => new Set([...prev, f.path]))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  {pendingFiles.map((f, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 px-3 rounded-md border border-dashed text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 truncate">{f.name}</span>
                      <span className="text-xs text-muted-foreground">{(f.size / 1024).toFixed(0)} KB</span>
                      <Badge variant="secondary" className="text-xs">pending</Badge>
                      <Button type="button" size="icon" variant="ghost" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <input ref={fileInputRef} type="file" multiple accept="image/*,.pdf,.doc,.docx,.xlsx,.ppt,.pptx,.dxf,.dwg" className="hidden" onChange={handleFileSelect} />
              <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-3.5 w-3.5 mr-1.5" />Add Files
              </Button>
            </div>

            <Separator />

            {/* ── Admin ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Admin</p>
              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="status" render={({ field }) => (
                  <FormItem><FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="new">New</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="proposal_sent">Proposal Sent</SelectItem>
                        <SelectItem value="converted">Converted</SelectItem>
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Link to project</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage />
                  </FormItem>
                )} />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 pb-6">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving…" : "Save Brief"}
              </Button>
            </div>

          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Phase Editor ─────────────────────────────────────────────────────────────
function PhaseEditor({ phases, onChange }: { phases: ProposalPhase[]; onChange: (p: ProposalPhase[]) => void }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  function toggleExpand(id: string) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  function updatePhase(id: string, field: keyof ProposalPhase, value: any) {
    onChange(phases.map(p => p.id === id ? { ...p, [field]: value } : p));
  }

  function addPhase() {
    const newPhase: ProposalPhase = { id: crypto.randomUUID(), name: "", description: "", fee: 0, timeline: "", deliverables: [] };
    onChange([...phases, newPhase]);
    setExpanded(prev => ({ ...prev, [newPhase.id]: true }));
  }

  function removePhase(id: string) {
    onChange(phases.filter(p => p.id !== id));
  }

  function addDeliverable(phaseId: string) {
    onChange(phases.map(p => p.id === phaseId ? { ...p, deliverables: [...p.deliverables, { id: crypto.randomUUID(), title: "" }] } : p));
  }

  function updateDeliverable(phaseId: string, dId: string, title: string) {
    onChange(phases.map(p => p.id === phaseId ? { ...p, deliverables: p.deliverables.map(d => d.id === dId ? { ...d, title } : d) } : p));
  }

  function removeDeliverable(phaseId: string, dId: string) {
    onChange(phases.map(p => p.id === phaseId ? { ...p, deliverables: p.deliverables.filter(d => d.id !== dId) } : p));
  }

  return (
    <div className="space-y-2">
      {phases.map((phase, idx) => (
        <div key={phase.id} className="border rounded-md">
          <div
            className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
            onClick={() => toggleExpand(phase.id)}
          >
            <span className="text-xs font-medium text-muted-foreground w-5">{idx + 1}</span>
            <span className="flex-1 text-sm font-medium">{phase.name || <span className="text-muted-foreground italic">Unnamed phase</span>}</span>
            <span className="text-xs text-muted-foreground">{phase.fee ? fmt(phase.fee) : "—"}</span>
            {expanded[phase.id] ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            <Button size="icon" variant="ghost" onClick={(e) => { e.stopPropagation(); removePhase(phase.id); }}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          {expanded[phase.id] && (
            <div className="px-3 pb-3 space-y-3 border-t pt-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium mb-1 block">Phase Name</label>
                  <Input value={phase.name} onChange={(e) => updatePhase(phase.id, "name", e.target.value)} placeholder="e.g. Concept Design" />
                </div>
                <div>
                  <label className="text-xs font-medium mb-1 block">Fee</label>
                  <Input type="number" value={phase.fee || ""} onChange={(e) => updatePhase(phase.id, "fee", Number(e.target.value))} placeholder="0" />
                </div>
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Timeline</label>
                <Input value={phase.timeline} onChange={(e) => updatePhase(phase.id, "timeline", e.target.value)} placeholder="e.g. 3–4 weeks" />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block">Description</label>
                <Textarea rows={2} value={phase.description} onChange={(e) => updatePhase(phase.id, "description", e.target.value)} placeholder="What this phase covers..." />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-medium">Deliverables</label>
                  <Button type="button" size="sm" variant="outline" onClick={() => addDeliverable(phase.id)}>
                    <Plus className="h-3 w-3 mr-1" />Add
                  </Button>
                </div>
                <div className="space-y-1.5">
                  {phase.deliverables.map((d) => (
                    <div key={d.id} className="flex items-center gap-2">
                      <Input value={d.title} onChange={(e) => updateDeliverable(phase.id, d.id, e.target.value)} placeholder="Deliverable..." className="text-sm" />
                      <Button type="button" size="icon" variant="ghost" onClick={() => removeDeliverable(phase.id, d.id)}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addPhase}>
        <Plus className="h-3.5 w-3.5 mr-1.5" />Add Phase
      </Button>
    </div>
  );
}

// ─── Proposal Sheet ───────────────────────────────────────────────────────────
function ProposalSheet({ open, onClose, proposal, briefs, projects }: {
  open: boolean;
  onClose: () => void;
  proposal?: Proposal | null;
  briefs: ClientBrief[];
  projects: Project[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!proposal;

  const existingPhases = proposal?.phases as ProposalPhase[] | undefined;
  const [phases, setPhases] = useState<ProposalPhase[]>(existingPhases?.length ? existingPhases : DEFAULT_PHASES.map(p => ({ ...p, id: crypto.randomUUID(), deliverables: p.deliverables.map(d => ({ ...d, id: crypto.randomUUID() })) })));

  const totalFee = phases.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      proposalTitle: proposal?.proposalTitle ?? "",
      clientName: proposal?.clientName ?? "",
      clientEmail: proposal?.clientEmail ?? "",
      feeStructure: proposal?.feeStructure ?? "flat_fee",
      percentageRate: proposal?.percentageRate?.toString() ?? "",
      hourlyRate: proposal?.hourlyRate?.toString() ?? "",
      currency: proposal?.currency ?? "INR",
      paymentSchedule: proposal?.paymentSchedule ?? DEFAULT_PAYMENT_SCHEDULE,
      termsAndConditions: proposal?.termsAndConditions ?? DEFAULT_TERMS,
      validityDays: proposal?.validityDays ?? 30,
      status: proposal?.status ?? "draft",
      briefId: proposal?.briefId ?? "",
      projectId: proposal?.projectId ?? "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: ProposalFormValues) => {
      const payload = {
        ...data,
        phases,
        totalFee: totalFee.toString(),
        briefId: data.briefId || null,
        projectId: data.projectId || null,
        clientEmail: data.clientEmail || null,
      };
      if (isEdit) return apiRequest("PUT", `/api/proposals/${proposal.id}`, payload);
      return apiRequest("POST", "/api/proposals", payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["/api/proposals"] });
      toast({ title: isEdit ? "Proposal updated" : "Proposal created" });
      onClose();
    },
    onError: () => toast({ title: "Error", description: "Could not save proposal", variant: "destructive" }),
  });

  const feeStructure = form.watch("feeStructure");

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle>{isEdit ? "Edit Proposal" : "New Proposal"}</SheetTitle>
        </SheetHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit((d) => mutation.mutate(d))} className="space-y-6">
            {/* Client & Meta */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Client Information</p>
              <div className="grid grid-cols-2 gap-4">
                <FormField control={form.control} name="proposalTitle" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Proposal Title *</FormLabel><FormControl><Input placeholder="e.g. Design Proposal — Maker Tower Apartment" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Client Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel>Client Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="briefId" render={({ field }) => (
                  <FormItem><FormLabel>Linked Brief</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {briefs.map(b => <SelectItem key={b.id} value={b.id}>{b.clientName}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="projectId" render={({ field }) => (
                  <FormItem><FormLabel>Linked Project</FormLabel>
                    <Select onValueChange={(v) => field.onChange(v === "__none__" ? "" : v)} value={field.value || "__none__"}>
                      <FormControl><SelectTrigger><SelectValue placeholder="None" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Fee Structure */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Fee Structure</p>
              <div className="grid grid-cols-3 gap-4">
                <FormField control={form.control} name="feeStructure" render={({ field }) => (
                  <FormItem><FormLabel>Fee Type</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="flat_fee">Flat Fee</SelectItem>
                        <SelectItem value="percentage">% of Project Cost</SelectItem>
                        <SelectItem value="hourly">Hourly</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="currency" render={({ field }) => (
                  <FormItem><FormLabel>Currency</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="INR">INR</SelectItem>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="AED">AED</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                {feeStructure === "percentage" && (
                  <FormField control={form.control} name="percentageRate" render={({ field }) => (
                    <FormItem><FormLabel>Rate (%)</FormLabel><FormControl><Input type="number" placeholder="10" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
                {feeStructure === "hourly" && (
                  <FormField control={form.control} name="hourlyRate" render={({ field }) => (
                    <FormItem><FormLabel>Hourly Rate</FormLabel><FormControl><Input type="number" placeholder="0" {...field} /></FormControl><FormMessage /></FormItem>
                  )} />
                )}
              </div>
            </div>

            <Separator />

            {/* Phases */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Phases & Deliverables</p>
                <span className="text-sm font-medium">Total: {fmt(totalFee, form.watch("currency"))}</span>
              </div>
              <PhaseEditor phases={phases} onChange={setPhases} />
            </div>

            <Separator />

            {/* Terms */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Payment & Terms</p>
              <div className="space-y-4">
                <FormField control={form.control} name="paymentSchedule" render={({ field }) => (
                  <FormItem><FormLabel>Payment Schedule</FormLabel><FormControl><Textarea rows={4} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="termsAndConditions" render={({ field }) => (
                  <FormItem><FormLabel>Terms & Conditions</FormLabel><FormControl><Textarea rows={6} {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <div className="grid grid-cols-2 gap-4">
                  <FormField control={form.control} name="validityDays" render={({ field }) => (
                    <FormItem><FormLabel>Valid for (days)</FormLabel><FormControl><Input type="number" {...field} onChange={e => field.onChange(Number(e.target.value))} /></FormControl><FormMessage /></FormItem>
                  )} />
                  <FormField control={form.control} name="status" render={({ field }) => (
                    <FormItem><FormLabel>Status</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                        <SelectContent>
                          <SelectItem value="draft">Draft</SelectItem>
                          <SelectItem value="sent">Sent</SelectItem>
                          <SelectItem value="accepted">Accepted</SelectItem>
                          <SelectItem value="rejected">Rejected</SelectItem>
                        </SelectContent>
                      </Select><FormMessage /></FormItem>
                  )} />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 pb-4">
              <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
              <Button type="submit" disabled={mutation.isPending}>{mutation.isPending ? "Saving..." : isEdit ? "Save Changes" : "Create Proposal"}</Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  );
}

// ─── Proposal Preview Dialog ──────────────────────────────────────────────────
function ProposalPreview({ proposal, open, onClose }: { proposal: Proposal; open: boolean; onClose: () => void }) {
  const phases = (proposal.phases as ProposalPhase[]) ?? [];
  const currency = proposal.currency ?? "INR";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Proposal Preview</DialogTitle>
        </DialogHeader>
        <div className="space-y-6 py-2">
          {/* Header */}
          <div className="border-b pb-4">
            <h2 className="text-xl font-semibold">{proposal.proposalTitle}</h2>
            <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><User className="h-3.5 w-3.5" />{proposal.clientName}</span>
              {proposal.clientEmail && <span className="flex items-center gap-1"><Mail className="h-3.5 w-3.5" />{proposal.clientEmail}</span>}
              <span className="flex items-center gap-1"><Calendar className="h-3.5 w-3.5" />Valid for {proposal.validityDays} days from issue</span>
            </div>
            <div className="mt-2">
              <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${PROPOSAL_STATUSES[proposal.status]?.color}`}>
                {PROPOSAL_STATUSES[proposal.status]?.label ?? proposal.status}
              </span>
            </div>
          </div>

          {/* Phases */}
          <div>
            <h3 className="text-sm font-semibold mb-3">Scope of Work & Fee Breakdown</h3>
            <div className="space-y-4">
              {phases.map((phase, i) => (
                <div key={phase.id} className="border rounded-md p-4">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <div>
                      <span className="text-xs text-muted-foreground mr-2">Phase {i + 1}</span>
                      <span className="font-medium">{phase.name}</span>
                      {phase.timeline && <span className="ml-2 text-xs text-muted-foreground">· {phase.timeline}</span>}
                    </div>
                    <span className="font-semibold text-sm shrink-0">{fmt(phase.fee, currency)}</span>
                  </div>
                  {phase.description && <p className="text-sm text-muted-foreground mt-1">{phase.description}</p>}
                  {phase.deliverables.length > 0 && (
                    <ul className="mt-2 space-y-0.5">
                      {phase.deliverables.filter(d => d.title).map(d => (
                        <li key={d.id} className="text-sm flex items-center gap-1.5 text-muted-foreground">
                          <CheckCircle className="h-3.5 w-3.5 text-primary shrink-0" />{d.title}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            <div className="mt-3 flex justify-end border-t pt-3">
              <div className="text-right">
                <span className="text-sm text-muted-foreground mr-3">Total Design Fee</span>
                <span className="text-lg font-semibold">{fmt(proposal.totalFee, currency)}</span>
              </div>
            </div>
          </div>

          {/* Payment Schedule */}
          {proposal.paymentSchedule && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Payment Schedule</h3>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">{proposal.paymentSchedule}</pre>
            </div>
          )}

          {/* Terms */}
          {proposal.termsAndConditions && (
            <div>
              <h3 className="text-sm font-semibold mb-2">Terms & Conditions</h3>
              <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans">{proposal.termsAndConditions}</pre>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectBriefPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const role = (user as any)?.role as string | undefined;
  const isAdmin = role === "admin";
  const isAdminOrDesigner = role === "admin" || role === "designer";

  const [briefSheetOpen, setBriefSheetOpen] = useState(false);
  const [editBrief, setEditBrief] = useState<ClientBrief | null>(null);
  const [proposalSheetOpen, setProposalSheetOpen] = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [previewProposal, setPreviewProposal] = useState<Proposal | null>(null);

  const { data: briefs = [], isLoading: briefsLoading } = useQuery<ClientBrief[]>({ queryKey: ["/api/client-briefs"] });
  const { data: proposals = [], isLoading: proposalsLoading } = useQuery<Proposal[]>({ queryKey: ["/api/proposals"] });
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const deleteBriefMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/client-briefs/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/client-briefs"] }); toast({ title: "Brief deleted" }); },
  });

  const deleteProposalMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/proposals/${id}`),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/proposals"] }); toast({ title: "Proposal deleted" }); },
  });

  const markSentMutation = useMutation({
    mutationFn: (id: string) => apiRequest("PUT", `/api/proposals/${id}`, { status: "sent", sentAt: new Date().toISOString() }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["/api/proposals"] }); toast({ title: "Marked as sent" }); },
  });

  if (user && !isAdminOrDesigner) {
    navigate("/");
    return null;
  }

  function openNewBrief() { setEditBrief(null); setBriefSheetOpen(true); }
  function openEditBrief(b: ClientBrief) { setEditBrief(b); setBriefSheetOpen(true); }
  function openNewProposal() { setEditProposal(null); setProposalSheetOpen(true); }
  function openEditProposal(p: Proposal) { setEditProposal(p); setProposalSheetOpen(true); }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold flex items-center gap-2">
          <ClipboardList className="h-5 w-5" />
          Project Brief
        </h1>
        <p className="text-sm text-muted-foreground mt-1">Capture client requirements and prepare proposals.</p>
      </div>

      <Tabs defaultValue="briefs">
        <TabsList>
          <TabsTrigger value="briefs">Client Briefs</TabsTrigger>
          <TabsTrigger value="proposals">Proposals</TabsTrigger>
        </TabsList>

        {/* ── Briefs Tab ── */}
        <TabsContent value="briefs" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{briefs.length} brief{briefs.length !== 1 ? "s" : ""}</p>
            <Button onClick={openNewBrief}>
              <Plus className="h-4 w-4 mr-2" />New Brief
            </Button>
          </div>

          {briefsLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : briefs.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No briefs yet</p>
              <p className="text-xs mt-1">Capture your first client brief to get started.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {briefs.map(b => {
                const statusInfo = BRIEF_STATUSES[b.status] ?? { label: b.status, variant: "secondary" as const };
                return (
                  <Card key={b.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base">{b.clientName}</CardTitle>
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                      </div>
                      {b.projectType && <p className="text-xs text-muted-foreground">{b.projectType}</p>}
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      {b.clientEmail && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Mail className="h-3.5 w-3.5 shrink-0" /><span>{b.clientEmail}</span>
                        </div>
                      )}
                      {b.propertyAddress && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{b.propertyAddress}</span>
                        </div>
                      )}
                      {(b.budgetMin || b.budgetMax) && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <DollarSign className="h-3.5 w-3.5 shrink-0" />
                          <span>
                            {b.budgetMin && b.budgetMax ? `${fmt(b.budgetMin, b.currency)} – ${fmt(b.budgetMax, b.currency)}` :
                              b.budgetMin ? `From ${fmt(b.budgetMin, b.currency)}` :
                              `Up to ${fmt(b.budgetMax!, b.currency)}`}
                          </span>
                        </div>
                      )}
                      {b.timeline && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="h-3.5 w-3.5 shrink-0" /><span>{b.timeline}</span>
                        </div>
                      )}
                      <div className="flex gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => openEditBrief(b)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this brief?")) deleteBriefMutation.mutate(b.id); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(b.createdAt), "dd MMM yyyy")}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* ── Proposals Tab ── */}
        <TabsContent value="proposals" className="mt-4">
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm text-muted-foreground">{proposals.length} proposal{proposals.length !== 1 ? "s" : ""}</p>
            <Button onClick={openNewProposal}>
              <Plus className="h-4 w-4 mr-2" />New Proposal
            </Button>
          </div>

          {proposalsLoading ? (
            <div className="text-center py-12 text-muted-foreground text-sm">Loading...</div>
          ) : proposals.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No proposals yet</p>
              <p className="text-xs mt-1">Create your first proposal to share with a client.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {proposals.map(p => {
                const statusInfo = PROPOSAL_STATUSES[p.status] ?? { label: p.status, color: "bg-muted text-muted-foreground" };
                const phases = (p.phases as ProposalPhase[]) ?? [];
                return (
                  <Card key={p.id}>
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <CardTitle className="text-base leading-snug">{p.proposalTitle}</CardTitle>
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${statusInfo.color}`}>{statusInfo.label}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{p.clientName}</p>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <DollarSign className="h-3.5 w-3.5 shrink-0" />
                        <span className="font-medium text-foreground">{fmt(p.totalFee, p.currency)}</span>
                        <span>· {phases.length} phase{phases.length !== 1 ? "s" : ""}</span>
                      </div>
                      {p.feeStructure === "percentage" && p.percentageRate && (
                        <p className="text-xs text-muted-foreground">{p.percentageRate}% of project cost</p>
                      )}
                      <div className="flex flex-wrap gap-2 pt-2">
                        <Button size="sm" variant="outline" onClick={() => setPreviewProposal(p)}>
                          <Eye className="h-3.5 w-3.5 mr-1" />Preview
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => openEditProposal(p)}>
                          <Pencil className="h-3.5 w-3.5 mr-1" />Edit
                        </Button>
                        {p.status === "draft" && (
                          <Button size="sm" variant="outline" onClick={() => markSentMutation.mutate(p.id)}>
                            <Send className="h-3.5 w-3.5 mr-1" />Mark Sent
                          </Button>
                        )}
                        {isAdmin && (
                          <Button size="sm" variant="outline" onClick={() => { if (confirm("Delete this proposal?")) deleteProposalMutation.mutate(p.id); }}>
                            <Trash2 className="h-3.5 w-3.5 mr-1" />Delete
                          </Button>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.createdAt), "dd MMM yyyy")}
                        {p.sentAt && ` · Sent ${format(new Date(p.sentAt), "dd MMM")}`}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Sheets & Dialogs */}
      <BriefSheet
        open={briefSheetOpen}
        onClose={() => { setBriefSheetOpen(false); setEditBrief(null); }}
        brief={editBrief}
        projects={projects}
      />
      <ProposalSheet
        key={editProposal?.id ?? "new"}
        open={proposalSheetOpen}
        onClose={() => { setProposalSheetOpen(false); setEditProposal(null); }}
        proposal={editProposal}
        briefs={briefs}
        projects={projects}
      />
      {previewProposal && (
        <ProposalPreview
          proposal={previewProposal}
          open={!!previewProposal}
          onClose={() => setPreviewProposal(null)}
        />
      )}
    </div>
  );
}
