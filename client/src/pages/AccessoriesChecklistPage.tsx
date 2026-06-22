import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import {
  ChevronDown, ChevronRight, Plus, Pencil, Trash2, Loader2,
  PackageCheck, AlertCircle, ListChecks,
} from "lucide-react";
import { format } from "date-fns";
import type { Project } from "@shared/schema";

interface HandoverItem {
  id: string;
  orgId: string;
  projectId: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  status: "pending" | "sourced" | "installed";
  notes: string | null;
  sortOrder: number;
  createdAt: string;
}

const STATUS_ORDER = ["pending", "sourced", "installed"] as const;

const STATUS_LABELS: Record<string, string> = {
  pending: "Pending",
  sourced: "Sourced",
  installed: "Installed",
};

const STATUS_VARIANTS: Record<string, "secondary" | "outline" | "default"> = {
  pending: "secondary",
  sourced: "outline",
  installed: "default",
};

const UNIT_OPTIONS = ["nos", "set", "pair", "sqft", "mtr", "box", "roll"];

function StatusBadge({ status }: { status: string }) {
  const variant = STATUS_VARIANTS[status] ?? "secondary";
  const isInstalled = status === "installed";
  return (
    <Badge
      variant={variant}
      className={`no-default-active-elevate text-xs shrink-0 ${isInstalled ? "bg-green-600 text-white hover:bg-green-600" : ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}

function ProgressBar({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden min-w-16">
        <div
          className="h-full bg-green-500 rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-muted-foreground shrink-0">{done}/{total}</span>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function AccessoriesChecklistPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const role = (user as any)?.role as string;

  const canEdit = role === "admin" || role === "designer" || role === "project_manager";

  const [activeProjectId, setActiveProjectId] = useState<string>("");
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [addCategory, setAddCategory] = useState("");
  const [editItem, setEditItem] = useState<HandoverItem | null>(null);

  // Add item form state
  const [formName, setFormName] = useState("");
  const [formCategory, setFormCategory] = useState("");
  const [formQty, setFormQty] = useState("1");
  const [formUnit, setFormUnit] = useState("nos");
  const [formStatus, setFormStatus] = useState<"pending" | "sourced" | "installed">("pending");
  const [formNotes, setFormNotes] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const itemsKey = ["/api/handover-items", activeProjectId];
  const { data: items = [], isLoading } = useQuery<HandoverItem[]>({
    queryKey: itemsKey,
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/handover-items?projectId=${activeProjectId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!activeProjectId,
    staleTime: 0,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: itemsKey });

  // Populate with defaults
  const populateMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/handover-items/populate", { projectId: activeProjectId }),
    onSuccess: () => { invalidate(); toast({ title: "Standard items loaded" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to load standard items" }),
  });

  // Create item
  const createMutation = useMutation({
    mutationFn: (data: Partial<HandoverItem>) => apiRequest("POST", "/api/handover-items", data),
    onSuccess: () => {
      invalidate();
      setAddItemOpen(false);
      resetForm();
      toast({ title: "Item added" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to add item" }),
  });

  // Update item
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }: Partial<HandoverItem> & { id: string }) =>
      apiRequest("PATCH", `/api/handover-items/${id}`, data),
    onSuccess: () => {
      invalidate();
      setEditItem(null);
      resetForm();
      toast({ title: "Item updated" });
    },
    onError: () => toast({ variant: "destructive", title: "Failed to update item" }),
  });

  // Quick status toggle
  const statusMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      apiRequest("PATCH", `/api/handover-items/${id}`, { status }),
    onSuccess: () => invalidate(),
    onError: () => toast({ variant: "destructive", title: "Failed to update status" }),
  });

  // Delete item
  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/handover-items/${id}`),
    onSuccess: () => { invalidate(); toast({ title: "Item removed" }); },
    onError: () => toast({ variant: "destructive", title: "Failed to delete item" }),
  });

  const resetForm = () => {
    setFormName(""); setFormCategory(""); setFormQty("1");
    setFormUnit("nos"); setFormStatus("pending"); setFormNotes("");
    setAddCategory("");
  };

  const openAddForCategory = (cat: string) => {
    resetForm();
    setFormCategory(cat);
    setAddCategory(cat);
    setAddItemOpen(true);
  };

  const openEdit = (item: HandoverItem) => {
    setEditItem(item);
    setFormName(item.name);
    setFormCategory(item.category);
    setFormQty(String(item.quantity));
    setFormUnit(item.unit);
    setFormStatus(item.status);
    setFormNotes(item.notes ?? "");
  };

  const handleSave = () => {
    const data = {
      projectId: activeProjectId,
      name: formName.trim(),
      category: formCategory.trim(),
      quantity: parseInt(formQty, 10) || 1,
      unit: formUnit,
      status: formStatus,
      notes: formNotes.trim() || null,
    };
    if (!data.name || !data.category) return;
    if (editItem) {
      updateMutation.mutate({ id: editItem.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Group items by category
  const groups = useMemo(() => {
    const map = new Map<string, HandoverItem[]>();
    for (const item of items) {
      if (!map.has(item.category)) map.set(item.category, []);
      map.get(item.category)!.push(item);
    }
    return Array.from(map.entries()).map(([category, catItems]) => ({
      category,
      items: catItems,
      installed: catItems.filter((i) => i.status === "installed").length,
    }));
  }, [items]);

  const totalInstalled = items.filter((i) => i.status === "installed").length;
  const activeProject = projects.find((p) => p.id === activeProjectId);

  // Unique categories for form dropdown
  const existingCategories = useMemo(() => Array.from(new Set(items.map((i) => i.category))), [items]);

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="border-b bg-background px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold flex items-center gap-2">
              <PackageCheck className="h-5 w-5 text-muted-foreground" />
              Accessories Checklist
            </h1>
            {activeProject && (
              <p className="text-sm text-muted-foreground mt-0.5">{activeProject.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={activeProjectId} onValueChange={setActiveProjectId}>
              <SelectTrigger className="w-60">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.projectName} — {p.clientName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {canEdit && activeProjectId && (
              <Button onClick={() => { resetForm(); setAddItemOpen(true); }}>
                <Plus className="h-4 w-4 mr-2" />Add Item
              </Button>
            )}
          </div>
        </div>

        {/* Progress summary */}
        {activeProjectId && !isLoading && items.length > 0 && (
          <div className="mt-3 flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2 min-w-48">
              <span className="text-sm text-muted-foreground shrink-0">Overall progress</span>
              <ProgressBar done={totalInstalled} total={items.length} />
            </div>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-muted-foreground/40 inline-block" />
                {items.filter((i) => i.status === "pending").length} pending
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-amber-400 inline-block" />
                {items.filter((i) => i.status === "sourced").length} sourced
              </span>
              <span className="flex items-center gap-1">
                <span className="h-2 w-2 rounded-full bg-green-500 inline-block" />
                {totalInstalled} installed
              </span>
            </div>
          </div>
        )}
      </div>

      {/* ── Body ───────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">

        {/* No project */}
        {!activeProjectId && (
          <div className="flex flex-col items-center justify-center h-64 gap-2 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Select a project to view its accessories checklist.</p>
          </div>
        )}

        {/* Loading */}
        {activeProjectId && isLoading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty state */}
        {activeProjectId && !isLoading && items.length === 0 && canEdit && (
          <div className="flex flex-col items-center justify-center h-64 gap-3 text-center">
            <ListChecks className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No items yet</p>
            <p className="text-sm text-muted-foreground max-w-sm">
              Load the standard accessories template to get started, or add items individually.
            </p>
            <div className="flex gap-2 mt-1">
              <Button
                onClick={() => populateMutation.mutate()}
                disabled={populateMutation.isPending}
              >
                {populateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Load standard items
              </Button>
              <Button variant="outline" onClick={() => { resetForm(); setAddItemOpen(true); }}>
                <Plus className="h-4 w-4 mr-1" />Add item
              </Button>
            </div>
          </div>
        )}

        {/* Groups */}
        {activeProjectId && !isLoading && groups.length > 0 && (
          <div className="space-y-2">
            {groups.map((group) => (
              <CategorySection
                key={group.category}
                category={group.category}
                items={group.items}
                installed={group.installed}
                canEdit={canEdit}
                onAddItem={openAddForCategory}
                onEdit={openEdit}
                onDelete={(id) => deleteMutation.mutate(id)}
                onStatusToggle={(item) => {
                  const next = item.status === "pending" ? "sourced"
                    : item.status === "sourced" ? "installed" : "pending";
                  statusMutation.mutate({ id: item.id, status: next });
                }}
                onInstallToggle={(item) => {
                  statusMutation.mutate({
                    id: item.id,
                    status: item.status === "installed" ? "pending" : "installed",
                  });
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Add / Edit Dialog ──────────────────────────────────────────── */}
      <Dialog
        open={addItemOpen || !!editItem}
        onOpenChange={(o) => { if (!o) { setAddItemOpen(false); setEditItem(null); resetForm(); } }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editItem ? "Edit Item" : "Add Item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-1">
            <div className="space-y-1.5">
              <Label>Item name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Pedal dustbin"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label>Category <span className="text-destructive">*</span></Label>
              <Select value={formCategory} onValueChange={setFormCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {existingCategories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                  <SelectItem value="__new__">New category…</SelectItem>
                </SelectContent>
              </Select>
              {(formCategory === "__new__" || !existingCategories.includes(formCategory)) && (
                <Input
                  placeholder="Type new category name…"
                  value={formCategory === "__new__" ? "" : formCategory}
                  onChange={(e) => setFormCategory(e.target.value)}
                  autoFocus={formCategory === "__new__"}
                />
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Quantity</Label>
                <Input
                  type="number"
                  min={1}
                  value={formQty}
                  onChange={(e) => setFormQty(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Unit</Label>
                <Select value={formUnit} onValueChange={setFormUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {UNIT_OPTIONS.map((u) => (
                      <SelectItem key={u} value={u}>{u}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={formStatus} onValueChange={(v) => setFormStatus(v as any)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_ORDER.map((s) => (
                    <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                placeholder="Brand, model, supplier, etc."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="resize-none"
                rows={2}
              />
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => { setAddItemOpen(false); setEditItem(null); resetForm(); }}>
              Cancel
            </Button>
            <Button
              disabled={!formName.trim() || !formCategory.trim() || formCategory === "__new__" || isPending}
              onClick={handleSave}
            >
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editItem ? "Save changes" : "Add item"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Category section ───────────────────────────────────────────────────────
function CategorySection({
  category, items, installed, canEdit,
  onAddItem, onEdit, onDelete, onStatusToggle, onInstallToggle,
}: {
  category: string;
  items: HandoverItem[];
  installed: number;
  canEdit: boolean;
  onAddItem: (cat: string) => void;
  onEdit: (item: HandoverItem) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (item: HandoverItem) => void;
  onInstallToggle: (item: HandoverItem) => void;
}) {
  const [open, setOpen] = useState(true);
  const allDone = installed === items.length && items.length > 0;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover-elevate rounded-md text-left">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
            <span className={`font-medium text-sm truncate ${allDone ? "text-green-600" : ""}`}>
              {category}
            </span>
            <Badge variant="secondary" className="no-default-active-elevate shrink-0">{items.length}</Badge>
          </div>
          <div className="ml-4 w-32 shrink-0">
            <ProgressBar done={installed} total={items.length} />
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-1 mb-3 space-y-1">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              canEdit={canEdit}
              onEdit={onEdit}
              onDelete={onDelete}
              onStatusToggle={onStatusToggle}
              onInstallToggle={onInstallToggle}
            />
          ))}
          {canEdit && (
            <button
              onClick={() => onAddItem(category)}
              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover-elevate rounded-md"
            >
              <Plus className="h-3.5 w-3.5" />
              Add item to {category}
            </button>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Item row ───────────────────────────────────────────────────────────────
function ItemRow({
  item, canEdit, onEdit, onDelete, onStatusToggle, onInstallToggle,
}: {
  item: HandoverItem;
  canEdit: boolean;
  onEdit: (item: HandoverItem) => void;
  onDelete: (id: string) => void;
  onStatusToggle: (item: HandoverItem) => void;
  onInstallToggle: (item: HandoverItem) => void;
}) {
  const isInstalled = item.status === "installed";
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-md border ${isInstalled ? "opacity-70" : ""} hover-elevate`}>
      {/* Install checkbox */}
      <Checkbox
        checked={isInstalled}
        onCheckedChange={() => canEdit && onInstallToggle(item)}
        disabled={!canEdit}
        className="shrink-0"
        title="Mark as installed"
      />

      {/* Name + notes */}
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium ${isInstalled ? "line-through text-muted-foreground" : ""}`}>
          {item.name}
        </p>
        {item.notes && (
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{item.notes}</p>
        )}
      </div>

      {/* Qty */}
      <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
        {item.quantity} {item.unit}
      </span>

      {/* Status badge — click to cycle status */}
      {canEdit ? (
        <button
          onClick={() => onStatusToggle(item)}
          title="Click to advance status"
          className="shrink-0"
        >
          <StatusBadge status={item.status} />
        </button>
      ) : (
        <StatusBadge status={item.status} />
      )}

      {/* Actions */}
      {canEdit && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => onEdit(item)}
            title="Edit"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="text-destructive"
            onClick={() => onDelete(item.id)}
            title="Delete"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  );
}
