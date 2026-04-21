import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Pencil, Trash2, Download, FileText, ChevronRight, BookOpen } from "lucide-react";
import { RecentBadge } from "@/components/RecentBadge";

interface Sop {
  id: string;
  title: string;
  category: string;
  description: string | null;
  content: string | null;
  fileName: string | null;
  filePath: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

interface FormState {
  title: string;
  category: string;
  description: string;
  content: string;
  file: File | null;
}

const EMPTY_FORM: FormState = {
  title: "",
  category: "",
  description: "",
  content: "",
  file: null,
};

export default function SOPsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedSop, setSelectedSop] = useState<Sop | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSop, setEditingSop] = useState<Sop | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<Sop | null>(null);

  const { data: currentUser } = useQuery<{ role: string }>({
    queryKey: ["/api/auth/user"],
    retry: false,
  });

  const isAdmin = currentUser?.role === "admin";
  const canWrite =
    currentUser?.role === "admin" ||
    currentUser?.role === "designer" ||
    currentUser?.role === "project_manager";

  const { data: sops = [], isLoading } = useQuery<Sop[]>({
    queryKey: ["/api/sops"],
    staleTime: 0,
    refetchOnMount: "always",
  });

  const createMutation = useMutation({
    mutationFn: async (fd: FormData) => {
      const res = await fetch("/api/sops", {
        method: "POST",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP created" });
      closeDialog();
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, fd }: { id: string; fd: FormData }) => {
      const res = await fetch(`/api/sops/${id}`, {
        method: "PUT",
        body: fd,
        credentials: "include",
      });
      if (!res.ok) throw new Error((await res.json()).error || "Failed");
      return res.json();
    },
    onSuccess: (updated: Sop) => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP updated" });
      if (selectedSop?.id === updated.id) setSelectedSop(updated);
      closeDialog();
    },
    onError: (e: any) =>
      toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/sops/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/sops"] });
      toast({ title: "SOP deleted" });
      if (selectedSop?.id === deleteTarget?.id) setSelectedSop(null);
      setDeleteTarget(null);
    },
    onError: () =>
      toast({ title: "Error deleting SOP", variant: "destructive" }),
  });

  const categories = Array.from(new Set(sops.map((s) => s.category))).sort();

  const filtered = sops.filter((s) => {
    const matchesSearch =
      !search ||
      s.title.toLowerCase().includes(search.toLowerCase()) ||
      s.category.toLowerCase().includes(search.toLowerCase()) ||
      (s.description || "").toLowerCase().includes(search.toLowerCase());
    const matchesCat =
      selectedCategory === "all" || s.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const grouped = filtered.reduce<Record<string, Sop[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  function openCreate() {
    setEditingSop(null);
    setForm(EMPTY_FORM);
    setDialogOpen(true);
  }

  function openEdit(sop: Sop) {
    setEditingSop(sop);
    setForm({
      title: sop.title,
      category: sop.category,
      description: sop.description || "",
      content: sop.content || "",
      file: null,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingSop(null);
    setForm(EMPTY_FORM);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.category.trim()) {
      toast({ title: "Title and category are required", variant: "destructive" });
      return;
    }
    const fd = new FormData();
    fd.append("title", form.title.trim());
    fd.append("category", form.category.trim());
    fd.append("description", form.description.trim());
    fd.append("content", form.content.trim());
    if (form.file) fd.append("file", form.file);

    if (editingSop) {
      updateMutation.mutate({ id: editingSop.id, fd });
    } else {
      createMutation.mutate(fd);
    }
  }

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Standard Operating Procedures</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {sops.length} SOP{sops.length !== 1 ? "s" : ""} across {categories.length} categor{categories.length !== 1 ? "ies" : "y"}
          </p>
        </div>
        {canWrite && (
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1.5" />
            New SOP
          </Button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search SOPs…"
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            variant={selectedCategory === "all" ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory("all")}
          >
            All
          </Badge>
          {categories.map((cat) => (
            <Badge
              key={cat}
              variant={selectedCategory === cat ? "default" : "outline"}
              className="cursor-pointer"
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </Badge>
          ))}
        </div>
      </div>

      {/* Main content — two-panel layout */}
      <div className="flex gap-4 min-h-[500px]">
        {/* Left — SOP list */}
        <div className="w-72 shrink-0 flex flex-col gap-1 overflow-y-auto pr-1">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-4">Loading…</p>
          ) : Object.keys(grouped).length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                {search || selectedCategory !== "all"
                  ? "No SOPs match your search."
                  : "No SOPs yet. Click 'New SOP' to create one."}
              </p>
            </div>
          ) : (
            Object.entries(grouped).map(([cat, items]) => (
              <div key={cat} className="mb-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide px-2 py-1.5">
                  {cat}
                </p>
                {items.map((sop) => (
                  <button
                    key={sop.id}
                    onClick={() => setSelectedSop(sop)}
                    className={`w-full text-left px-3 py-2.5 rounded-md text-sm transition-colors flex items-center justify-between gap-2 group
                      ${selectedSop?.id === sop.id
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted text-foreground"}`}
                  >
                    <span className="truncate font-medium flex-1">{sop.title}</span>
                    <RecentBadge date={sop.updatedAt} days={3} />
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  </button>
                ))}
              </div>
            ))
          )}
        </div>

        {/* Right — SOP detail */}
        <div className="flex-1 min-w-0">
          {selectedSop ? (
            <Card className="h-full">
              <CardHeader className="pb-3 flex flex-row items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <CardTitle className="text-lg leading-tight">{selectedSop.title}</CardTitle>
                  <Badge variant="secondary" className="mt-1.5 text-xs">{selectedSop.category}</Badge>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  {selectedSop.filePath && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(`/api/sops/${selectedSop.id}/download`, "_blank")}
                    >
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      {selectedSop.fileName || "Download"}
                    </Button>
                  )}
                  {canWrite && (
                    <Button size="icon" variant="ghost" onClick={() => openEdit(selectedSop)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  )}
                  {isAdmin && (
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setDeleteTarget(selectedSop)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4 overflow-y-auto">
                {selectedSop.description && (
                  <p className="text-sm text-muted-foreground">{selectedSop.description}</p>
                )}
                {selectedSop.content ? (
                  <div className="text-sm text-foreground whitespace-pre-wrap leading-relaxed border-t pt-4">
                    {selectedSop.content}
                  </div>
                ) : (
                  !selectedSop.description && !selectedSop.filePath && (
                    <p className="text-sm text-muted-foreground italic">No content added yet.</p>
                  )
                )}
                {selectedSop.filePath && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground border rounded-md px-3 py-2 bg-muted/40">
                    <FileText className="h-4 w-4 shrink-0" />
                    <span className="truncate">{selectedSop.fileName}</span>
                  </div>
                )}
                <p className="text-xs text-muted-foreground pt-2 border-t">
                  Last updated {new Date(selectedSop.updatedAt).toLocaleDateString("en-IN", {
                    day: "numeric", month: "short", year: "numeric",
                  })}
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="h-full flex items-center justify-center text-center">
              <div className="space-y-2">
                <BookOpen className="h-12 w-12 text-muted-foreground/30 mx-auto" />
                <p className="text-muted-foreground text-sm">Select an SOP to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) closeDialog(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingSop ? "Edit SOP" : "New SOP"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Title <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Site Inspection Procedure"
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Category <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. Site Operations"
                  value={form.category}
                  list="sop-categories"
                  onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                />
                <datalist id="sop-categories">
                  {categories.map((c) => <option key={c} value={c} />)}
                </datalist>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Short description</Label>
              <Input
                placeholder="One-line summary of this procedure"
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Procedure content</Label>
              <Textarea
                placeholder="Step-by-step procedure, guidelines, checklists…"
                className="min-h-[150px] resize-y"
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Attach file (PDF, Word, etc.)</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.png,.jpg,.jpeg"
                className="block w-full text-sm text-muted-foreground file:mr-3 file:py-1 file:px-3 file:rounded file:border file:border-input file:bg-muted file:text-foreground file:text-sm cursor-pointer"
                onChange={(e) => setForm((f) => ({ ...f, file: e.target.files?.[0] || null }))}
              />
              {editingSop?.fileName && !form.file && (
                <p className="text-xs text-muted-foreground">Current: {editingSop.fileName}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="ghost" onClick={closeDialog} disabled={isPending}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={isPending}>
                {isPending ? "Saving…" : editingSop ? "Save changes" : "Create SOP"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) setDeleteTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete SOP?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteTarget?.title}" will be permanently deleted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
