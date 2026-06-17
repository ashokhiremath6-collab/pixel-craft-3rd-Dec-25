import { useState, useRef, useMemo } from "react";
import { useSearch } from "wouter";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import {
  Upload, Eye, Trash2, Loader2, ChevronDown, ChevronRight,
  Pencil, ImageIcon, Search, AlertCircle, X, User as UserIcon,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Moodboard, Project, User } from "@shared/schema";
import { FileViewerModal } from "@/components/FileViewerModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

// ── Room type ordering ─────────────────────────────────────────────────────
const ROOM_ORDER = [
  "Living Room", "Foyer", "Bedroom", "Master Bedroom", "Kitchen",
  "Dining Room", "Bathroom", "Study", "Kids Room", "Guest Room",
  "Puja Room", "Hallway", "Walk-in Closet", "Balcony", "General",
];

function inferRoomType(name: string): string {
  if (!name) return "General";
  const n = name.toLowerCase().replace(/[-_]/g, " ");
  if (/foyer/.test(n)) return "Foyer";
  if (/living|lounge|sitting|family room|great room/.test(n)) return "Living Room";
  if (/master/.test(n)) return "Master Bedroom";
  if (/bedroom|kids room|children room/.test(n)) return "Bedroom";
  if (/kitchen|pantry|cook/.test(n)) return "Kitchen";
  if (/dining|dinner room|breakfast/.test(n)) return "Dining Room";
  if (/bathroom|toilet|washroom|powder room|bath/.test(n)) return "Bathroom";
  if (/study|library|work room|den/.test(n)) return "Study";
  if (/\boffice\b/.test(n)) return "Study";
  if (/nursery|playroom/.test(n)) return "Kids Room";
  if (/\bkids\b|\bchildren\b/.test(n)) return "Kids Room";
  if (/\bguest\b/.test(n)) return "Guest Room";
  if (/puja|prayer|pooja|temple|mandir/.test(n)) return "Puja Room";
  if (/hallway|corridor|entrance|entry/.test(n)) return "Hallway";
  if (/closet|wardrobe|dressing/.test(n)) return "Walk-in Closet";
  if (/balcony|terrace|patio|verandah/.test(n)) return "Balcony";
  return "General";
}

function getRoomType(render: Moodboard): string {
  const stored = (render as any).roomType;
  return stored && stored !== "General"
    ? stored
    : inferRoomType(render.name || (render as any).description || "");
}

function getPreviewUrl(render: Moodboard): string | null {
  if (!render.fileName) return null;
  if (render.filePath?.startsWith("/objects/")) return render.filePath;
  return `/uploads/moodboards/${render.fileName}`;
}

// ── GroupSection (matches Working Drawings style) ─────────────────────────
function GroupSection({
  label, count, children, defaultOpen,
}: {
  label: string; count: number; children: React.ReactNode; defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover-elevate rounded-md mb-1 text-left">
          <div className="flex items-center gap-2">
            {open
              ? <ChevronDown className="h-4 w-4 text-muted-foreground" />
              : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-sm">{label}</span>
            <Badge variant="secondary" className="no-default-active-elevate">{count}</Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mb-3">{children}</div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────
export default function RendersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const search = useSearch();
  const params = new URLSearchParams(search);

  const [activeProjectId, setActiveProjectId] = useState<string>(params.get("projectId") || "");
  const [searchText, setSearchText] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingRender, setViewingRender] = useState<Moodboard | null>(null);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRender, setEditingRender] = useState<Moodboard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoomType, setEditRoomType] = useState("");

  // Upload form state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadRoomType, setUploadRoomType] = useState("");
  const [uploadProjectId, setUploadProjectId] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
    enabled: user?.role === "admin",
  });

  const userMap = useMemo(() => {
    const m = new Map<string, string>();
    users.forEach((u: User) => {
      m.set(u.id, u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.email || "Unknown");
    });
    return m;
  }, [users]);

  const rendersKey = ["/api/moodboards/by-type", "render", activeProjectId || null];
  const { data: renders = [], isLoading } = useQuery<Moodboard[]>({
    queryKey: rendersKey,
    queryFn: async () => {
      if (!activeProjectId) return [];
      const sp = new URLSearchParams({ projectId: activeProjectId });
      const res = await fetch(`/api/moodboards/by-type/render?${sp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch renders");
      return res.json();
    },
    enabled: !!activeProjectId,
    staleTime: 0,
    refetchOnMount: "always",
  });

  // ── Filtering & grouping ─────────────────────────────────────────────────
  const filtered = useMemo(() => {
    if (!searchText.trim()) return renders;
    const t = searchText.toLowerCase();
    return renders.filter((r) =>
      (r.name || "").toLowerCase().includes(t) ||
      getRoomType(r).toLowerCase().includes(t)
    );
  }, [renders, searchText]);

  const groups = useMemo(() => {
    const map = new Map<string, Moodboard[]>();
    for (const r of filtered) {
      const rt = getRoomType(r);
      if (!map.has(rt)) map.set(rt, []);
      map.get(rt)!.push(r);
    }
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      const ia = ROOM_ORDER.indexOf(a), ib = ROOM_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sorted.map(([room, items]) => ({ room, items }));
  }, [filtered]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      if (!uploadProjectId) throw new Error("Select a project");
      const fd = new FormData();
      fd.append("moodboard", uploadFile);
      fd.append("assetType", "render");
      fd.append("projectId", uploadProjectId);
      if (uploadName.trim()) fd.append("description", uploadName.trim());
      if (uploadRoomType) fd.append("roomType", uploadRoomType);
      const res = await fetch("/api/moodboards", { method: "POST", body: fd });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Upload failed"); }
      return res.json();
    },
    onSuccess: () => {
      invalidate();
      setUploadOpen(false);
      setUploadFile(null);
      setUploadName("");
      setUploadRoomType("");
      setUploadProjectId(activeProjectId || "");
      toast({ title: "Render uploaded", description: "Your render has been added." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Upload failed", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, roomType }: { id: string; name: string; roomType: string }) =>
      apiRequest("PUT", `/api/moodboards/${id}`, { name: name.trim(), roomType }),
    onSuccess: () => {
      invalidate();
      setEditingRender(null);
      toast({ title: "Render updated" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Update failed", description: e.message }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiRequest("DELETE", `/api/moodboards/${id}`),
    onSuccess: () => {
      invalidate();
      setDeletingId(null);
      toast({ title: "Render deleted" });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Delete failed", description: e.message }),
  });

  // ── File handling ─────────────────────────────────────────────────────────
  const handleFileSelect = (files: FileList | null) => {
    if (!files?.length) return;
    const file = files[0];
    const allowed = ["jpg","jpeg","png","svg","webp","pdf","heic","heif","skp"];
    const ext = file.name.split(".").pop()?.toLowerCase() || "";
    if (!allowed.includes(ext) && !file.type.startsWith("image/") && file.type !== "application/pdf") {
      toast({ variant: "destructive", title: "Invalid file type", description: "Upload images (JPEG, PNG, WebP, SVG) or PDFs." });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast({ variant: "destructive", title: "File too large", description: "Max 50 MB." });
      return;
    }
    setUploadFile(file);
    if (!uploadName) setUploadName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " ").trim());
    const inferred = inferRoomType(file.name);
    if (!uploadRoomType && inferred !== "General") setUploadRoomType(inferred);
  };

  const handleView = async (render: Moodboard) => {
    const url = getPreviewUrl(render);
    if (!url) return;
    setViewingRender(render);
    setViewerUrl({ url, name: render.name || render.fileName || "Render" });
  };

  const activeProject = projects.find((p) => p.id === activeProjectId);

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="border-b bg-background px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-semibold">Renders</h1>
            {activeProject && (
              <p className="text-sm text-muted-foreground mt-0.5">{activeProject.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project selector */}
            <Select value={activeProjectId} onValueChange={(v) => { setActiveProjectId(v); setUploadProjectId(v); }}>
              <SelectTrigger className="w-56">
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

            {/* Upload button */}
            <Button onClick={() => { setUploadProjectId(activeProjectId); setUploadOpen(true); }}>
              <Upload className="h-4 w-4 mr-2" />
              Upload Render
            </Button>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search renders…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="pl-8 w-52"
              />
              {searchText && (
                <button
                  onClick={() => setSearchText("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Stats row */}
        {activeProjectId && !isLoading && renders.length > 0 && (
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground">
            <span>{renders.length} renders</span>
            <span>{groups.length} rooms</span>
          </div>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* No project selected */}
        {!activeProjectId && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">Select a project to view its renders.</p>
          </div>
        )}

        {/* Loading */}
        {activeProjectId && isLoading && (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Empty */}
        {activeProjectId && !isLoading && renders.length === 0 && (
          <div className="flex flex-col items-center justify-center h-64 text-center gap-2">
            <ImageIcon className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No renders yet</p>
            <p className="text-sm text-muted-foreground">Upload your first render to get started.</p>
            <Button className="mt-2" onClick={() => setUploadOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />Upload Render
            </Button>
          </div>
        )}

        {/* Search empty */}
        {activeProjectId && !isLoading && renders.length > 0 && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
            <Search className="h-6 w-6 text-muted-foreground" />
            <p className="text-muted-foreground">No renders match "{searchText}".</p>
          </div>
        )}

        {/* Groups */}
        {activeProjectId && !isLoading && groups.length > 0 && (
          <div className="space-y-1">
            {groups.map((group, idx) => (
              <GroupSection key={group.room} label={group.room} count={group.items.length} defaultOpen={false}>
                {group.items.map((render) => {
                  const previewUrl = getPreviewUrl(render);
                  const savedByName = (render as any).savedBy ? userMap.get((render as any).savedBy) : null;
                  return (
                    <div
                      key={render.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-md hover-elevate border"
                    >
                      {/* Thumbnail */}
                      <div className="shrink-0 w-12 h-10 rounded overflow-hidden bg-muted flex items-center justify-center">
                        {previewUrl && render.fileType !== "pdf" ? (
                          <img
                            src={previewUrl}
                            alt={render.name || ""}
                            className="w-full h-full object-cover"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        ) : (
                          <ImageIcon className="h-5 w-5 text-muted-foreground" />
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{render.name || render.fileName || "Untitled"}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap mt-0.5">
                          <span>{format(new Date(render.uploadedAt), "dd MMM yyyy, HH:mm")}</span>
                          {savedByName && (
                            <>
                              <span>•</span>
                              <span className="flex items-center gap-1">
                                <UserIcon className="h-3 w-3" />
                                {savedByName}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1 shrink-0">
                        {previewUrl && (
                          <Button variant="ghost" size="icon" onClick={() => handleView(render)} title="View">
                            <Eye className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditingRender(render);
                            setEditName(render.name || "");
                            setEditRoomType(getRoomType(render));
                          }}
                          title="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => setDeletingId(render.id)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </GroupSection>
            ))}
          </div>
        )}
      </div>

      {/* ── Upload Sheet ─────────────────────────────────────────────────── */}
      <Sheet open={uploadOpen} onOpenChange={setUploadOpen}>
        <SheetContent side="right" className="w-[420px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Upload Render</SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
            {/* Project */}
            <div className="space-y-1.5">
              <Label>Project <span className="text-destructive">*</span></Label>
              <Select value={uploadProjectId} onValueChange={setUploadProjectId}>
                <SelectTrigger>
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
            </div>

            {/* Drop zone */}
            <div
              className={`border-2 border-dashed rounded-md p-6 text-center cursor-pointer transition-colors ${
                dragActive ? "border-primary bg-primary/5" : "border-muted-foreground/25 hover:border-primary/50"
              }`}
              onDragEnter={(e) => { e.preventDefault(); setDragActive(true); }}
              onDragLeave={(e) => { e.preventDefault(); setDragActive(false); }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => { e.preventDefault(); setDragActive(false); handleFileSelect(e.dataTransfer.files); }}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadFile ? (
                <div className="flex items-center justify-center gap-2 text-sm">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium truncate max-w-xs">{uploadFile.name}</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); setUploadFile(null); }}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <>
                  <Upload className="h-6 w-6 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm font-medium">Drop your render here, or click to browse</p>
                  <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, SVG, PDF up to 50 MB</p>
                </>
              )}
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept="image/*,application/pdf,.skp,application/vnd.sketchup.skp"
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </div>

            {/* Name */}
            <div className="space-y-1.5">
              <Label>Render name</Label>
              <Input
                placeholder="e.g. Living Room — Day View"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
              />
            </div>

            {/* Room type */}
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select
                value={ROOM_ORDER.includes(uploadRoomType) ? uploadRoomType : ""}
                onValueChange={setUploadRoomType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or type a custom room name..."
                value={ROOM_ORDER.includes(uploadRoomType) ? "" : uploadRoomType}
                onChange={(e) => setUploadRoomType(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t px-6 py-4 flex gap-2">
            <Button
              className="flex-1"
              disabled={!uploadFile || !uploadProjectId || uploadMutation.isPending}
              onClick={() => uploadMutation.mutate()}
            >
              {uploadMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
            <Button variant="outline" onClick={() => setUploadOpen(false)}>Cancel</Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit Dialog ───────────────────────────────────────────────────── */}
      <Dialog open={!!editingRender} onOpenChange={(o) => !o && setEditingRender(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Render</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Room</Label>
              <Select
                value={ROOM_ORDER.includes(editRoomType) ? editRoomType : ""}
                onValueChange={setEditRoomType}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {ROOM_ORDER.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                placeholder="Or type a custom room name..."
                value={ROOM_ORDER.includes(editRoomType) ? "" : editRoomType}
                onChange={(e) => setEditRoomType(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditingRender(null)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending}
              onClick={() => editingRender && updateMutation.mutate({ id: editingRender.id, name: editName, roomType: editRoomType })}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ────────────────────────────────────────────────── */}
      <DeleteConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={() => deletingId && deleteMutation.mutate(deletingId)}
        isDeleting={deleteMutation.isPending}
      />

      {/* ── Viewer ────────────────────────────────────────────────────────── */}
      {viewerUrl && (
        <FileViewerModal
          isOpen={!!viewerUrl}
          onClose={() => { setViewerUrl(null); setViewingRender(null); }}
          fileUrl={viewerUrl.url}
          fileName={viewerUrl.name}
        />
      )}
    </div>
  );
}
