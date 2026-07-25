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
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  ClipboardList, Plus, Pencil, Trash2, Eye, FileText,
  User, Mail, Phone, MapPin, DollarSign, Calendar, Send,
  CheckCircle, XCircle, ChevronDown, ChevronUp, X, MoreHorizontal, Download
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

// ─── Brief View Sheet (read-only) ─────────────────────────────────────────────
function BriefViewSheet({ open, onClose, brief, onEdit }: {
  open: boolean;
  onClose: () => void;
  brief: ClientBrief | null;
  onEdit: () => void;
}) {
  if (!brief) return null;

  const statusInfo = BRIEF_STATUSES[brief.status] ?? { label: brief.status, variant: "secondary" as const };
  const refs = (brief.referenceFiles as any[]) || [];

  // Parse the composed scopeOfWork text back into structured fields
  function parseKeyedLines(text: string | null | undefined, prefix: string): string | null {
    if (!text) return null;
    const line = text.split("\n").find(l => l.startsWith(prefix + ": "));
    return line ? line.slice(prefix.length + 2).trim() : null;
  }
  function freeText(text: string | null | undefined, ...prefixes: string[]): string {
    if (!text) return "";
    return text.split("\n").filter(l => !prefixes.some(p => l.startsWith(p + ": "))).join("\n").trim();
  }

  const scope = brief.scopeOfWork ?? "";
  const scopeType  = parseKeyedLines(scope, "Scope");
  const workType   = parseKeyedLines(scope, "Work type");
  const roomsRaw   = parseKeyedLines(scope, "Rooms");
  const bedrooms   = parseKeyedLines(scope, "Bedrooms");
  const childBeds  = parseKeyedLines(scope, "Children's bedrooms");
  const occupants  = parseKeyedLines(scope, "Occupants");
  const ages       = parseKeyedLines(scope, "Ages");
  const scopeExtra = freeText(scope, "Scope", "Work type", "Rooms", "Bedrooms", "Children's bedrooms", "Occupants", "Ages");
  const rooms      = roomsRaw ? roomsRaw.split(",").map(r => r.trim()).filter(Boolean) : [];

  const style = brief.stylePreferences ?? "";
  const styleRaw   = parseKeyedLines(style, "Style direction");
  const styleExtra = freeText(style, "Style direction");
  const styles     = styleRaw ? styleRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

  function Pill({ label }: { label: string }) {
    return <span className="inline-block px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium text-foreground">{label}</span>;
  }

  function Section({ title, children }: { title: string; children: React.ReactNode }) {
    return (
      <div className="space-y-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground border-b pb-1.5">{title}</p>
        {children}
      </div>
    );
  }

  function Row({ icon: Icon, label, value }: { icon?: React.ElementType; label: string; value: string | null | undefined }) {
    if (!value) return null;
    return (
      <div className="flex gap-3">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground mt-0.5 whitespace-pre-line">{value}</p>
        </div>
      </div>
    );
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-xl overflow-y-auto flex flex-col gap-0 p-0">
        {/* Header */}
        <div className="bg-muted/40 border-b px-6 py-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-tight">{brief.clientName}</h2>
              {brief.projectType && <p className="text-sm text-muted-foreground mt-0.5">{brief.projectType}</p>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
              <Button size="sm" variant="outline" onClick={onEdit}>
                <Pencil className="h-3.5 w-3.5 mr-1.5" />Edit
              </Button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-3">
            Created {format(new Date(brief.createdAt), "dd MMM yyyy")}
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 px-6 py-6 space-y-7 overflow-y-auto">

          {/* Contact */}
          <Section title="Contact">
            <div className="space-y-3">
              <Row icon={Mail} label="Email" value={brief.clientEmail} />
              <Row icon={Phone} label="Phone" value={brief.phone} />
              <Row icon={MapPin} label="Property address" value={brief.propertyAddress} />
            </div>
          </Section>

          {/* Scope */}
          {(scopeType || workType || rooms.length > 0 || bedrooms || occupants || ages || scopeExtra) && (
            <Section title="Scope of work">
              <div className="space-y-3">
                {scopeType && <Row label="Scope" value={scopeType} />}
                {workType && <Row label="Work type" value={workType} />}
                {rooms.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Rooms</p>
                    <div className="flex flex-wrap gap-1.5">{rooms.map(r => <Pill key={r} label={r} />)}</div>
                  </div>
                )}
                {(bedrooms || childBeds) && (
                  <div className="flex gap-6">
                    {bedrooms && <Row label="Bedrooms" value={bedrooms} />}
                    {childBeds && <Row label="Children's bedrooms" value={childBeds} />}
                  </div>
                )}
                {occupants && <Row icon={User} label="Occupants" value={occupants} />}
                {ages && <Row label="Ages" value={ages} />}
                {scopeExtra && <Row label="Additional notes" value={scopeExtra} />}
              </div>
            </Section>
          )}

          {/* Design direction */}
          {(styles.length > 0 || styleExtra || brief.mustHaves || brief.mustAvoids || brief.inspirationNotes) && (
            <Section title="Design direction">
              <div className="space-y-4">
                {styles.length > 0 && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1.5">Style directions</p>
                    <div className="flex flex-wrap gap-1.5">{styles.map(s => <Pill key={s} label={s} />)}</div>
                  </div>
                )}
                {styleExtra && <Row label="Feel & preferences" value={styleExtra} />}
                {(brief.mustHaves || brief.mustAvoids) && (
                  <div className="grid grid-cols-2 gap-4">
                    {brief.mustHaves && (
                      <div className="rounded-md border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 p-3 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400">Must-haves</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{brief.mustHaves}</p>
                      </div>
                    )}
                    {brief.mustAvoids && (
                      <div className="rounded-md border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 p-3 space-y-1">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400">Must-avoids</p>
                        <p className="text-sm text-foreground whitespace-pre-line">{brief.mustAvoids}</p>
                      </div>
                    )}
                  </div>
                )}
                {brief.inspirationNotes && <Row label="Inspiration" value={brief.inspirationNotes} />}
              </div>
            </Section>
          )}

          {/* Reference files */}
          {refs.length > 0 && (
            <Section title="Reference files">
              <div className="space-y-1.5">
                {refs.map((f: any, i: number) => (
                  <a
                    key={i}
                    href={`/api/object-storage/file?path=${encodeURIComponent(f.path)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 px-3 py-2 rounded-md border text-sm hover:bg-muted transition-colors"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="flex-1 truncate">{f.name}</span>
                    {f.size && <span className="text-xs text-muted-foreground shrink-0">{(f.size / 1024).toFixed(0)} KB</span>}
                  </a>
                ))}
              </div>
            </Section>
          )}

        </div>
      </SheetContent>
    </Sheet>
  );
}

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
  const [occupants, setOccupants] = useState<string>("");
  const [occupantAges, setOccupantAges] = useState<string>("");
  const [selectedStyles, setSelectedStyles] = useState<Set<string>>(new Set());

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
      setOccupants("");
      setOccupantAges("");
      setSelectedStyles(new Set());
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
      if (occupants.trim()) scopeParts.push(`Occupants: ${occupants.trim()}`);
      if (occupantAges.trim()) scopeParts.push(`Ages: ${occupantAges.trim()}`);
      if (data.scopeOfWork?.trim()) scopeParts.push(data.scopeOfWork.trim());

      const styleParts: string[] = [];
      if (selectedStyles.size > 0) styleParts.push(`Style direction: ${Array.from(selectedStyles).join(", ")}`);
      if (data.stylePreferences?.trim()) styleParts.push(data.stylePreferences.trim());

      const keepRefs = ((brief?.referenceFiles as any[]) || []).filter((f: any) => !removedPaths.has(f.path));
      const payload = {
        ...data,
        scopeOfWork: scopeParts.join("\n") || null,
        stylePreferences: styleParts.join("\n") || null,
        timeline: null,
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

              <div>
                <Q number={5} label="Who will be living in the home?" hint="e.g. Couple, 2 adults + 2 children, elderly parent" />
                <Input value={occupants} onChange={e => setOccupants(e.target.value)} placeholder="e.g. Couple + 2 children + elderly parent" />
              </div>

              <div>
                <Q number={6} label="Ages of the occupants" hint="Helps tailor storage, accessibility, and room design" />
                <Input value={occupantAges} onChange={e => setOccupantAges(e.target.value)} placeholder="e.g. Adults: 38, 35 — Children: 9, 6 — Parent: 68" />
              </div>

              <FormField control={form.control} name="scopeOfWork" render={({ field }) => (
                <FormItem>
                  <Q number={7} label="Any additional scope details?" hint="Size of the home, special requirements, specific rooms not listed above, etc." />
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
                <Q number={8} label="Which style directions resonate with the client?" hint="Select one or more" />
                <div className="flex flex-wrap gap-2">
                  {STYLE_OPTIONS.map(s => (
                    <PillToggle key={s} label={s} selected={selectedStyles.has(s)} onToggle={() => toggleStyle(s)} />
                  ))}
                </div>
              </div>

              <FormField control={form.control} name="stylePreferences" render={({ field }) => (
                <FormItem>
                  <Q number={9} label="Describe the feel in your own words" hint="Materials, colours, mood, lighting preferences — anything goes." />
                  <FormControl><Textarea rows={3} placeholder="e.g. Warm and earthy — oak veneer, sage green accents, textured plaster. Natural light is a priority. No dark or heavy elements." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />

              <div className="grid grid-cols-2 gap-3">
                <FormField control={form.control} name="mustHaves" render={({ field }) => (
                  <FormItem>
                    <Q number={10} label="Must-haves" hint="Non-negotiables" />
                    <FormControl><Textarea rows={4} placeholder="e.g. Walk-in wardrobe, home office nook, concealed storage throughout, Italian marble in bathrooms." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form.control} name="mustAvoids" render={({ field }) => (
                  <FormItem>
                    <Q number={11} label="Must-avoids" hint="Things to stay away from" />
                    <FormControl><Textarea rows={4} placeholder="e.g. No dark walls, no brass, avoid heavy drapes, nothing too formal or hotel-like." {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </div>

              <FormField control={form.control} name="inspirationNotes" render={({ field }) => (
                <FormItem>
                  <Q number={12} label="Inspiration sources" hint="Hotels, projects, Instagram handles, Pinterest boards, magazines — links welcome." />
                  <FormControl><Textarea rows={2} placeholder="e.g. Soho House Mumbai, Studio Lotus projects, AD India Jan 2024 cover story." {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
            </div>

            <Separator />

            {/* ── Section D: Reference files ── */}
            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">D — Reference files</p>
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
function ProposalSheet({ open, onClose, proposal, prefillBrief, briefs, projects }: {
  open: boolean;
  onClose: () => void;
  proposal?: Proposal | null;
  prefillBrief?: ClientBrief | null;
  briefs: ClientBrief[];
  projects: Project[];
}) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const isEdit = !!proposal;

  const existingPhases = proposal?.phases as ProposalPhase[] | undefined;
  const [phases, setPhases] = useState<ProposalPhase[]>(existingPhases?.length ? existingPhases : DEFAULT_PHASES.map(p => ({ ...p, id: crypto.randomUUID(), deliverables: p.deliverables.map(d => ({ ...d, id: crypto.randomUUID() })) })));

  const totalFee = phases.reduce((sum, p) => sum + (Number(p.fee) || 0), 0);

  const buildDefaultValues = (b?: ClientBrief | null) => {
    if (b) {
      const addr = b.propertyAddress ? `, ${b.propertyAddress}` : "";
      return {
        proposalTitle: `Design Proposal — ${b.clientName}${addr}`,
        clientName: b.clientName,
        clientEmail: b.clientEmail ?? "",
        briefId: b.id,
      };
    }
    return { proposalTitle: "", clientName: "", clientEmail: "", briefId: "" };
  };

  const form = useForm<ProposalFormValues>({
    resolver: zodResolver(proposalFormSchema),
    defaultValues: {
      ...buildDefaultValues(prefillBrief),
      proposalTitle: proposal?.proposalTitle ?? buildDefaultValues(prefillBrief).proposalTitle,
      clientName: proposal?.clientName ?? buildDefaultValues(prefillBrief).clientName,
      clientEmail: proposal?.clientEmail ?? buildDefaultValues(prefillBrief).clientEmail ?? "",
      feeStructure: proposal?.feeStructure ?? "flat_fee",
      percentageRate: proposal?.percentageRate?.toString() ?? "",
      hourlyRate: proposal?.hourlyRate?.toString() ?? "",
      currency: proposal?.currency ?? "INR",
      paymentSchedule: proposal?.paymentSchedule ?? DEFAULT_PAYMENT_SCHEDULE,
      termsAndConditions: proposal?.termsAndConditions ?? DEFAULT_TERMS,
      validityDays: proposal?.validityDays ?? 30,
      status: proposal?.status ?? "draft",
      briefId: proposal?.briefId ?? buildDefaultValues(prefillBrief).briefId,
      projectId: proposal?.projectId ?? "",
    },
  });

  // Re-populate when the sheet opens with a different prefill brief
  useEffect(() => {
    if (open && prefillBrief && !isEdit) {
      const addr = prefillBrief.propertyAddress ? `, ${prefillBrief.propertyAddress}` : "";
      form.reset({
        ...form.getValues(),
        proposalTitle: `Design Proposal — ${prefillBrief.clientName}${addr}`,
        clientName: prefillBrief.clientName,
        clientEmail: prefillBrief.clientEmail ?? "",
        briefId: prefillBrief.id,
      });
    }
  }, [open, prefillBrief?.id]);

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
                {/* Linked Brief first — selecting it auto-fills the rest */}
                <FormField control={form.control} name="briefId" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Linked Brief</FormLabel>
                    <Select
                      onValueChange={(v) => {
                        const id = v === "__none__" ? "" : v;
                        field.onChange(id);
                        if (id) {
                          const brief = briefs.find(b => b.id === id);
                          if (brief) {
                            form.setValue("clientName", brief.clientName);
                            if (brief.clientEmail) form.setValue("clientEmail", brief.clientEmail);
                            const addr = brief.propertyAddress ? `, ${brief.propertyAddress}` : "";
                            form.setValue("proposalTitle", `Design Proposal — ${brief.clientName}${addr}`);
                          }
                        }
                      }}
                      value={field.value || "__none__"}
                    >
                      <FormControl><SelectTrigger><SelectValue placeholder="Select a brief to auto-fill" /></SelectTrigger></FormControl>
                      <SelectContent>
                        <SelectItem value="__none__">None</SelectItem>
                        {briefs.map(b => <SelectItem key={b.id} value={b.id}>{b.clientName} — {b.propertyAddress ?? b.projectType ?? ""}</SelectItem>)}
                      </SelectContent>
                    </Select><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="proposalTitle" render={({ field }) => (
                  <FormItem className="col-span-2"><FormLabel>Proposal Title *</FormLabel><FormControl><Input placeholder="e.g. Design Proposal — Maker Tower Apartment" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientName" render={({ field }) => (
                  <FormItem><FormLabel>Client Name *</FormLabel><FormControl><Input {...field} /></FormControl><FormMessage /></FormItem>
                )} />
                <FormField control={form.control} name="clientEmail" render={({ field }) => (
                  <FormItem><FormLabel>Client Email</FormLabel><FormControl><Input type="email" {...field} /></FormControl><FormMessage /></FormItem>
                )} />
              </div>
            </div>

            <Separator />

            {/* Fee Structure */}
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Fee Structure</p>
              <div className="grid grid-cols-2 gap-4">
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
                  <FormItem className="hidden">
                    <FormControl><Input {...field} value="INR" /></FormControl>
                  </FormItem>
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
  const [downloading, setDownloading] = useState(false);
  const { toast } = useToast();

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/download`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${proposal.proposalTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 60)}.docx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", description: "Could not generate the Word document.", variant: "destructive" });
    } finally {
      setDownloading(false);
    }
  };

  const issueDate = format(new Date(proposal.createdAt), "dd MMMM yyyy");
  const validUntil = format(new Date(Date.now() + (proposal.validityDays || 30) * 86400000), "dd MMMM yyyy");
  const statusInfo = PROPOSAL_STATUSES[proposal.status] ?? { label: proposal.status, color: "bg-muted text-muted-foreground" };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0">
        {/* Toolbar */}
        <div className="sticky top-0 z-10 flex items-center justify-between bg-white/95 backdrop-blur px-6 py-3 border-b">
          <span className="text-xs uppercase tracking-widest text-muted-foreground font-medium">Proposal Preview</span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" onClick={handleDownload} disabled={downloading}>
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {downloading ? "Generating…" : "Download .docx"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </div>
        </div>

        {/* Document body — white paper feel */}
        <div className="bg-[#FAFAF8] px-12 py-10 space-y-0 font-serif">

          {/* Studio / document type header */}
          <div className="border-b-2 border-[#B8860B] pb-6 mb-8">
            <p className="text-[10px] uppercase tracking-[0.3em] text-[#6B7280] mb-1">Design Proposal</p>
            <h1 className="text-3xl font-bold text-[#1A1A2E] leading-tight">{proposal.proposalTitle}</h1>
          </div>

          {/* Client + details two-column block */}
          <div className="grid grid-cols-2 gap-8 mb-10">
            <div>
              <p className="text-[9px] uppercase tracking-[0.25em] text-[#B8860B] font-sans mb-2">Prepared for</p>
              <p className="text-xl font-bold text-[#1A1A2E]">{proposal.clientName}</p>
              {proposal.clientEmail && <p className="text-sm text-[#6B7280] mt-0.5">{proposal.clientEmail}</p>}
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.25em] text-[#B8860B] font-sans mb-2">Proposal Details</p>
              <p className="text-sm text-[#1A1A2E]">Date: {issueDate}</p>
              <p className="text-sm text-[#1A1A2E]">Valid until: {validUntil}</p>
              <span className={`inline-flex items-center mt-1 px-2.5 py-0.5 rounded-full text-xs font-medium font-sans ${statusInfo.color}`}>{statusInfo.label}</span>
            </div>
          </div>

          {/* Scope of Work */}
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-4">
              <h2 className="text-[10px] uppercase tracking-[0.25em] text-[#B8860B] font-sans">Scope of Work & Fee Breakdown</h2>
              <div className="flex-1 h-px bg-[#B8860B]/30" />
            </div>
            <div className="space-y-4">
              {phases.length === 0 && <p className="text-sm text-[#6B7280] italic">Scope to be detailed on engagement.</p>}
              {phases.map((phase, i) => (
                <div key={phase.id} className="border border-[#E5E0D8] rounded-sm overflow-hidden">
                  <div className="bg-[#F0ECE6] px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] uppercase tracking-wider text-[#B8860B] font-sans">Phase {i + 1}</span>
                      <span className="text-sm font-bold text-[#1A1A2E]">{phase.name}</span>
                      {phase.timeline && <span className="text-xs text-[#6B7280]">· {phase.timeline}</span>}
                    </div>
                    <span className="text-sm font-bold text-[#1A1A2E]">{fmt(phase.fee, currency)}</span>
                  </div>
                  {(phase.description || phase.deliverables.filter(d => d.title).length > 0) && (
                    <div className="px-4 py-3 space-y-2">
                      {phase.description && <p className="text-sm text-[#6B7280] italic">{phase.description}</p>}
                      {phase.deliverables.filter(d => d.title).length > 0 && (
                        <ul className="space-y-1">
                          {phase.deliverables.filter(d => d.title).map(d => (
                            <li key={d.id} className="flex items-center gap-2 text-sm text-[#374151]">
                              <span className="text-[#B8860B] font-bold text-xs">✓</span>{d.title}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Total */}
            <div className="mt-4 bg-[#1A1A2E] rounded-sm px-4 py-3 flex items-center justify-between">
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/70 font-sans">Total Design Fee</span>
              <span className="text-xl font-bold text-[#B8860B]">{fmt(proposal.totalFee, currency)}</span>
            </div>
            {proposal.feeStructure === "percentage" && proposal.percentageRate && (
              <p className="text-xs text-[#6B7280] italic mt-1.5 text-right">{proposal.percentageRate}% of total project cost — confirmed post-execution</p>
            )}
          </div>

          {/* Payment Schedule */}
          {proposal.paymentSchedule && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[10px] uppercase tracking-[0.25em] text-[#B8860B] font-sans">Payment Schedule</h2>
                <div className="flex-1 h-px bg-[#B8860B]/30" />
              </div>
              <div className="space-y-1.5">
                {proposal.paymentSchedule.split("\n").filter(Boolean).map((line, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm text-[#374151]">
                    <span className="text-[#B8860B] mt-0.5">·</span>
                    <span>{line.trim()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Terms & Conditions */}
          {proposal.termsAndConditions && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-3">
                <h2 className="text-[10px] uppercase tracking-[0.25em] text-[#B8860B] font-sans">Terms & Conditions</h2>
                <div className="flex-1 h-px bg-[#B8860B]/30" />
              </div>
              <div className="space-y-1.5">
                {proposal.termsAndConditions.split("\n").filter(Boolean).map((line, i) => (
                  <p key={i} className="text-sm text-[#374151]">
                    <span className="text-[#B8860B] font-bold mr-1.5">{i + 1}.</span>{line.trim()}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Signature block */}
          <div className="border-t border-[#B8860B]/40 mt-10 pt-8 grid grid-cols-2 gap-8">
            <div>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#6B7280] font-sans mb-4">Client Acceptance</p>
              <div className="space-y-3 text-sm text-[#374151]">
                <p className="border-b border-[#D1D5DB] pb-4">Signature: </p>
                <p className="border-b border-[#D1D5DB] pb-4">Name: </p>
                <p className="border-b border-[#D1D5DB] pb-4">Date: </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#6B7280] font-sans mb-4">Authorised by</p>
              <p className="text-lg font-bold text-[#1A1A2E]">— Studio</p>
              <p className="text-sm text-[#6B7280] mt-1">{issueDate}</p>
            </div>
          </div>
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
  const [viewBrief, setViewBrief] = useState<ClientBrief | null>(null);
  const [proposalSheetOpen, setProposalSheetOpen] = useState(false);
  const [editProposal, setEditProposal] = useState<Proposal | null>(null);
  const [prefillBrief, setPrefillBrief] = useState<ClientBrief | null>(null);
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
  function openEditBrief(b: ClientBrief) { setViewBrief(null); setEditBrief(b); setBriefSheetOpen(true); }
  function openViewBrief(b: ClientBrief) { setViewBrief(b); }
  function openNewProposal() { setPrefillBrief(null); setEditProposal(null); setProposalSheetOpen(true); }
  function openEditProposal(p: Proposal) { setPrefillBrief(null); setEditProposal(p); setProposalSheetOpen(true); }
  function openNewProposalFromBrief(b: ClientBrief) { setPrefillBrief(b); setEditProposal(null); setProposalSheetOpen(true); }

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
            <div className="space-y-6">
              {briefs.map(b => {
                const statusInfo = BRIEF_STATUSES[b.status] ?? { label: b.status, variant: "secondary" as const };
                const refs = (b.referenceFiles as any[]) || [];

                // Parse scopeOfWork
                function parseKL(text: string | null | undefined, prefix: string) {
                  if (!text) return null;
                  const line = text.split("\n").find(l => l.startsWith(prefix + ": "));
                  return line ? line.slice(prefix.length + 2).trim() : null;
                }
                function freeLines(text: string | null | undefined, ...prefixes: string[]) {
                  if (!text) return "";
                  return text.split("\n").filter(l => !prefixes.some(p => l.startsWith(p + ": "))).join("\n").trim();
                }
                const scope = b.scopeOfWork ?? "";
                const scopeType  = parseKL(scope, "Scope");
                const workType   = parseKL(scope, "Work type");
                const roomsRaw   = parseKL(scope, "Rooms");
                const bedrooms   = parseKL(scope, "Bedrooms");
                const childBeds  = parseKL(scope, "Children's bedrooms");
                const occupants  = parseKL(scope, "Occupants");
                const ages       = parseKL(scope, "Ages");
                const scopeExtra = freeLines(scope, "Scope", "Work type", "Rooms", "Bedrooms", "Children's bedrooms", "Occupants", "Ages");
                const rooms      = roomsRaw ? roomsRaw.split(",").map(r => r.trim()).filter(Boolean) : [];

                const styleText  = b.stylePreferences ?? "";
                const styleRaw   = parseKL(styleText, "Style direction");
                const styleExtra = freeLines(styleText, "Style direction");
                const styles     = styleRaw ? styleRaw.split(",").map(s => s.trim()).filter(Boolean) : [];

                return (
                  <div key={b.id} className="rounded-xl border bg-card shadow-sm overflow-hidden">
                    {/* Header strip */}
                    <div className="flex items-start justify-between gap-3 px-6 py-5 border-b bg-muted/30">
                      <div className="min-w-0">
                        <h3 className="text-lg font-semibold leading-tight">{b.clientName}</h3>
                        {b.projectType && <p className="text-sm text-muted-foreground mt-0.5">{b.projectType}</p>}
                        <p className="text-xs text-muted-foreground mt-1">{format(new Date(b.createdAt), "dd MMM yyyy")}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
                        <Button size="sm" variant="outline" onClick={() => openNewProposalFromBrief(b)}>
                          <FileText className="h-3.5 w-3.5 mr-1.5" />New Proposal
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditBrief(b)}>
                              <Pencil className="h-3.5 w-3.5 mr-2" />Edit
                            </DropdownMenuItem>
                            {isAdmin && (
                              <DropdownMenuItem
                                className="text-destructive focus:text-destructive"
                                onClick={() => { if (confirm("Delete this brief?")) deleteBriefMutation.mutate(b.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5 mr-2" />Delete
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>

                    {/* Body */}
                    <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-6">

                      {/* Contact */}
                      {(b.clientEmail || b.phone || b.propertyAddress) && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</p>
                          {b.clientEmail && <div className="flex items-center gap-2 text-sm"><Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span>{b.clientEmail}</span></div>}
                          {b.phone && <div className="flex items-center gap-2 text-sm"><Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span>{b.phone}</span></div>}
                          {b.propertyAddress && <div className="flex items-center gap-2 text-sm"><MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" /><span>{b.propertyAddress}</span></div>}
                        </div>
                      )}

                      {/* Scope */}
                      {(scopeType || workType || rooms.length > 0 || bedrooms || occupants || ages || scopeExtra) && (
                        <div className="space-y-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scope of work</p>
                          <div className="space-y-1.5 text-sm">
                            {scopeType && <p><span className="text-muted-foreground">Scope: </span>{scopeType}</p>}
                            {workType && <p><span className="text-muted-foreground">Work type: </span>{workType}</p>}
                            {(bedrooms || childBeds) && (
                              <p>
                                {bedrooms && <><span className="text-muted-foreground">Bedrooms: </span>{bedrooms}</>}
                                {bedrooms && childBeds && <span className="mx-2 text-muted-foreground">·</span>}
                                {childBeds && <><span className="text-muted-foreground">Children's: </span>{childBeds}</>}
                              </p>
                            )}
                            {occupants && <p><span className="text-muted-foreground">Occupants: </span>{occupants}</p>}
                            {ages && <p><span className="text-muted-foreground">Ages: </span>{ages}</p>}
                            {rooms.length > 0 && (
                              <div className="flex flex-wrap gap-1 pt-1">
                                {rooms.map(r => <span key={r} className="inline-block px-2 py-0.5 rounded-full bg-muted text-xs font-medium">{r}</span>)}
                              </div>
                            )}
                            {scopeExtra && <p className="text-muted-foreground">{scopeExtra}</p>}
                          </div>
                        </div>
                      )}

                      {/* Design direction */}
                      {(styles.length > 0 || styleExtra || b.mustHaves || b.mustAvoids || b.inspirationNotes) && (
                        <div className="space-y-2 md:col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Design direction</p>
                          <div className="space-y-3">
                            {styles.length > 0 && (
                              <div className="flex flex-wrap gap-1.5">
                                {styles.map(s => <span key={s} className="inline-block px-2.5 py-0.5 rounded-full bg-muted text-xs font-medium">{s}</span>)}
                              </div>
                            )}
                            {styleExtra && <p className="text-sm text-muted-foreground italic">"{styleExtra}"</p>}
                            {(b.mustHaves || b.mustAvoids) && (
                              <div className="grid grid-cols-2 gap-3">
                                {b.mustHaves && (
                                  <div className="rounded-lg border border-green-200 bg-green-50 dark:border-green-900 dark:bg-green-950/30 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-green-700 dark:text-green-400 mb-1.5">Must-haves</p>
                                    <p className="text-sm whitespace-pre-line">{b.mustHaves}</p>
                                  </div>
                                )}
                                {b.mustAvoids && (
                                  <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30 px-4 py-3">
                                    <p className="text-[10px] font-bold uppercase tracking-wider text-red-700 dark:text-red-400 mb-1.5">Must-avoids</p>
                                    <p className="text-sm whitespace-pre-line">{b.mustAvoids}</p>
                                  </div>
                                )}
                              </div>
                            )}
                            {b.inspirationNotes && <p className="text-sm"><span className="text-muted-foreground">Inspiration: </span>{b.inspirationNotes}</p>}
                          </div>
                        </div>
                      )}

                      {/* Reference files */}
                      {refs.length > 0 && (
                        <div className="space-y-2 md:col-span-2">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Reference files</p>
                          <div className="flex flex-wrap gap-2">
                            {refs.map((f: any, i: number) => (
                              <a key={i} href={`/api/object-storage/file?path=${encodeURIComponent(f.path)}`} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-xs hover:bg-muted transition-colors">
                                <FileText className="h-3.5 w-3.5 text-muted-foreground" />{f.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
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
                        <Button size="sm" variant="outline" onClick={async () => {
                          try {
                            const res = await fetch(`/api/proposals/${p.id}/download`, { credentials: "include" });
                            if (!res.ok) throw new Error();
                            const blob = await res.blob();
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `${p.proposalTitle.replace(/[^a-zA-Z0-9 ]/g, "").replace(/\s+/g, "_").slice(0, 60)}.docx`;
                            a.click();
                            URL.revokeObjectURL(url);
                          } catch { /* silent */ }
                        }}>
                          <Download className="h-3.5 w-3.5 mr-1" />.docx
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
      <BriefViewSheet
        open={!!viewBrief}
        onClose={() => setViewBrief(null)}
        brief={viewBrief}
        onEdit={() => { openEditBrief(viewBrief!); }}
      />
      <BriefSheet
        open={briefSheetOpen}
        onClose={() => { setBriefSheetOpen(false); setEditBrief(null); }}
        brief={editBrief}
        projects={projects}
      />
      <ProposalSheet
        key={editProposal?.id ?? (prefillBrief?.id ?? "new")}
        open={proposalSheetOpen}
        onClose={() => { setProposalSheetOpen(false); setEditProposal(null); setPrefillBrief(null); }}
        proposal={editProposal}
        prefillBrief={prefillBrief}
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
