import { useState, useRef, useMemo, useEffect } from "react";
import { useSearch, useLocation } from "wouter";
import { sortProjectsForDropdown } from "@/lib/projectSort";
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
  Pencil, ImageIcon, Search, AlertCircle, X, User as UserIcon, Sparkles, Plus,
} from "lucide-react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { format } from "date-fns";
import type { Moodboard, Project, User } from "@shared/schema";
import { FileViewerModal } from "@/components/FileViewerModal";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";

// ── Default room order ─────────────────────────────────────────────────────
const DEFAULT_ROOM_ORDER = [
  "Living Room", "Foyer", "Bedroom", "Master Bedroom", "Kitchen",
  "Dining Room", "Bathroom", "Study", "Kids Room", "Guest Room",
  "Puja Room", "Hallway", "Walk-in Closet", "Balcony", "General",
];

function getProjectRooms(projectId: string): string[] {
  if (!projectId) return [];
  try {
    const stored = localStorage.getItem(`renders-rooms-${projectId}`);
    return stored ? JSON.parse(stored) : [];
  } catch {
    return [];
  }
}

function saveProjectRooms(projectId: string, rooms: string[]) {
  localStorage.setItem(`renders-rooms-${projectId}`, JSON.stringify(rooms));
}

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

function isAiGenerated(render: Moodboard): boolean {
  const tags = (render as any).tags;
  if (!tags) return false;
  if (Array.isArray(tags)) return tags.includes("ai-generated");
  return false;
}

function getPreviewUrl(render: Moodboard): string | null {
  if (!render.fileName) return null;
  if (render.filePath?.startsWith("/objects/")) return render.filePath;
  return `/uploads/moodboards/${render.fileName}`;
}

// ── GroupSection (room-level collapsible) ─────────────────────────────────
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

// ── SubGroupSection (subcategory within a room) ────────────────────────────
function SubGroupSection({
  label, count, children, icon,
}: {
  label: string; count: number; children: React.ReactNode; icon?: React.ReactNode;
}) {
  const [open, setOpen] = useState(true);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="ml-4 mb-2">
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover-elevate rounded-md">
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
          {icon}
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
          <Badge variant="outline" className="no-default-active-elevate text-xs px-1.5 py-0 h-4">{count}</Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 mt-1">{children}</div>
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

  const [, setLocation] = useLocation();
  const [activeProjectId, setActiveProjectId] = useState<string>(params.get("projectId") || "");
  const targetRenderId = params.get("renderId");
  const [searchText, setSearchText] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewingRender, setViewingRender] = useState<Moodboard | null>(null);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; name: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingRender, setEditingRender] = useState<Moodboard | null>(null);
  const [editName, setEditName] = useState("");
  const [editRoomType, setEditRoomType] = useState("");
  const [editCustomRoom, setEditCustomRoom] = useState("");

  // Add Room dialog
  const [addRoomOpen, setAddRoomOpen] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  // Per-project custom rooms (persisted in localStorage)
  const [customRooms, setCustomRooms] = useState<string[]>([]);

  // Upload form state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadName, setUploadName] = useState("");
  const [uploadRoomType, setUploadRoomType] = useState("");
  const [uploadCustomRoom, setUploadCustomRoom] = useState("");
  const [uploadProjectId, setUploadProjectId] = useState("");

  // ── Queries ──────────────────────────────────────────────────────────────
  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });

  useEffect(() => {
    if (!activeProjectId && projects.length > 0) {
      setActiveProjectId(sortProjectsForDropdown(projects)[0]?.id ?? "");
    }
  }, [projects, activeProjectId]);

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

  // ── Load per-project custom rooms from localStorage ───────────────────
  useEffect(() => {
    if (activeProjectId) {
      setCustomRooms(getProjectRooms(activeProjectId));
    }
  }, [activeProjectId]);

  // ── Combined ordered room list for this project ────────────────────────
  const allRoomOptions = useMemo(() => {
    // Rooms that already exist in renders data (not in default or custom list)
    const existingRooms = Array.from(new Set(renders.map(getRoomType)));
    const combined = [
      ...DEFAULT_ROOM_ORDER,
      ...customRooms.filter((r) => !DEFAULT_ROOM_ORDER.includes(r)),
      ...existingRooms.filter((r) => !DEFAULT_ROOM_ORDER.includes(r) && !customRooms.includes(r)),
    ];
    return combined;
  }, [customRooms, renders]);

  // ── Auto-open render from dashboard link ─────────────────────────────────
  // After opening, strip renderId from the URL so a page refresh won't re-trigger.
  const autoOpenedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!targetRenderId || renders.length === 0) return;
    if (autoOpenedRef.current === targetRenderId) return;
    const target = renders.find((r) => r.id === targetRenderId);
    if (!target) return;
    const url = getPreviewUrl(target);
    if (!url) return;
    autoOpenedRef.current = targetRenderId;
    setViewingRender(target);
    setViewerUrl({ url, name: target.name || target.fileName || "Render" });
    // Clean renderId from URL so refresh doesn't reopen the viewer
    setLocation(`/renders?projectId=${activeProjectId}`, { replace: true });
  }, [targetRenderId, renders]);

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
    const map = new Map<string, { ai: Moodboard[]; uploaded: Moodboard[] }>();

    // Pre-populate empty groups for custom rooms (so they appear even with 0 renders)
    for (const room of customRooms) {
      map.set(room, { ai: [], uploaded: [] });
    }

    for (const r of filtered) {
      const rt = getRoomType(r);
      if (!map.has(rt)) map.set(rt, { ai: [], uploaded: [] });
      if (isAiGenerated(r)) {
        map.get(rt)!.ai.push(r);
      } else {
        map.get(rt)!.uploaded.push(r);
      }
    }

    // Sort by allRoomOptions order
    const sorted = Array.from(map.entries()).sort(([a], [b]) => {
      const ia = allRoomOptions.indexOf(a), ib = allRoomOptions.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sorted.map(([room, { ai, uploaded }]) => ({
      room,
      ai,
      uploaded,
      total: ai.length + uploaded.length,
    }));
  }, [filtered, customRooms, allRoomOptions]);

  // ── Mutations ────────────────────────────────────────────────────────────
  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: rendersKey });
    queryClient.invalidateQueries({ queryKey: ["/api/moodboards"] });
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!uploadFile) throw new Error("No file selected");
      if (!uploadProjectId) throw new Error("Select a project");
      const effectiveRoom = uploadRoomType !== "__custom__" ? uploadRoomType : uploadCustomRoom.trim();
      const fd = new FormData();
      fd.append("moodboard", uploadFile);
      fd.append("assetType", "render");
      fd.append("projectId", uploadProjectId);
      if (uploadName.trim()) fd.append("description", uploadName.trim());
      if (effectiveRoom) fd.append("roomType", effectiveRoom);
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
      setUploadCustomRoom("");
      setUploadProjectId(activeProjectId || "");
      toast({ title: "Render uploaded", description: "Your render has been added." });
    },
    onError: (e: Error) => toast({ variant: "destructive", title: "Upload failed", description: e.message }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, name, roomType }: { id: string; name: string; roomType: string }) =>
      apiRequest("PUT", `/api/moodboards/${id}`, { name: name.trim(), roomType: roomType.trim() }),
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

  // ── Add room handler ───────────────────────────────────────────────────
  const handleAddRoom = () => {
    const name = newRoomName.trim();
    if (!name || !activeProjectId) return;
    if (allRoomOptions.some((r) => r.toLowerCase() === name.toLowerCase())) {
      toast({ variant: "destructive", title: "Room already exists" });
      return;
    }
    const updated = [...customRooms, name];
    setCustomRooms(updated);
    saveProjectRooms(activeProjectId, updated);
    setNewRoomName("");
    setAddRoomOpen(false);
    toast({ title: `Room "${name}" added` });
  };

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

  // Derived helpers for room selectors
  const effectiveEditRoom = editRoomType === "__custom__" ? editCustomRoom : editRoomType;
  const effectiveUploadRoom = uploadRoomType === "__custom__" ? uploadCustomRoom : uploadRoomType;

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
        {activeProjectId && !isLoading && (
          <div className="mt-2 flex items-center gap-4 text-sm text-muted-foreground flex-wrap">
            {renders.length > 0 && <span>{renders.length} renders</span>}
            {groups.length > 0 && <span>{groups.length} rooms</span>}
            {renders.filter(isAiGenerated).length > 0 && (
              <span className="flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" />
                {renders.filter(isAiGenerated).length} AI generated
              </span>
            )}
            {/* Add Room button */}
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs gap-1"
              onClick={() => { setNewRoomName(""); setAddRoomOpen(true); }}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Room
            </Button>
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
        {activeProjectId && !isLoading && renders.length === 0 && groups.length === 0 && (
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
            {groups.map((group) => {
              const hasAi = group.ai.length > 0;
              const hasUploaded = group.uploaded.length > 0;
              const hasBoth = hasAi && hasUploaded;

              const renderRow = (render: Moodboard) => {
                const previewUrl = getPreviewUrl(render);
                const savedByName = (render as any).savedBy ? userMap.get((render as any).savedBy) : null;
                const aiGen = isAiGenerated(render);
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
                      <div className="flex items-center gap-1.5 min-w-0">
                        <p className="font-medium text-sm truncate">{render.name || render.fileName || "Untitled"}</p>
                        {aiGen && !hasBoth && (
                          <Badge variant="secondary" className="no-default-active-elevate shrink-0 flex items-center gap-1 text-xs">
                            <Sparkles className="h-3 w-3" />AI
                          </Badge>
                        )}
                      </div>
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
                          const rt = getRoomType(render);
                          const isCustom = !allRoomOptions.includes(rt) && rt !== "";
                          setEditingRender(render);
                          setEditName(render.name || "");
                          setEditRoomType(isCustom ? "__custom__" : rt);
                          setEditCustomRoom(isCustom ? rt : "");
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
              };

              return (
                <GroupSection key={group.room} label={group.room} count={group.total} defaultOpen={group.total > 0}>
                  {group.total === 0 ? (
                    <p className="px-4 py-3 text-sm text-muted-foreground italic ml-4">
                      No renders in this room yet. Edit a render and assign it here.
                    </p>
                  ) : hasBoth ? (
                    <>
                      <SubGroupSection
                        label="AI Generated"
                        count={group.ai.length}
                        icon={<Sparkles className="h-3.5 w-3.5 text-muted-foreground" />}
                      >
                        {group.ai.map(renderRow)}
                      </SubGroupSection>
                      <SubGroupSection label="Uploaded" count={group.uploaded.length}>
                        {group.uploaded.map(renderRow)}
                      </SubGroupSection>
                    </>
                  ) : hasAi ? (
                    <>
                      <div className="flex items-center gap-1.5 px-3 py-1 ml-4">
                        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">AI Generated</span>
                      </div>
                      {group.ai.map(renderRow)}
                    </>
                  ) : (
                    group.uploaded.map(renderRow)
                  )}
                </GroupSection>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Room Dialog ───────────────────────────────────────────────── */}
      <Dialog open={addRoomOpen} onOpenChange={setAddRoomOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Add Room / Area</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Room name</Label>
              <Input
                placeholder="e.g. Pooja Room, Laundry, Terrace…"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddRoom()}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Creates an empty room group. Move renders here by editing them.
              </p>
            </div>
            {/* Show existing rooms as context */}
            {allRoomOptions.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">Current rooms</Label>
                <div className="flex flex-wrap gap-1">
                  {allRoomOptions.filter((r) => r !== "General").map((r) => (
                    <Badge key={r} variant="outline" className="no-default-active-elevate text-xs">{r}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setAddRoomOpen(false)}>Cancel</Button>
            <Button disabled={!newRoomName.trim()} onClick={handleAddRoom}>
              <Plus className="h-4 w-4 mr-1" />Add Room
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
              <Select value={uploadRoomType} onValueChange={(v) => { setUploadRoomType(v); if (v !== "__custom__") setUploadCustomRoom(""); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select room (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {allRoomOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom room name…</SelectItem>
                </SelectContent>
              </Select>
              {uploadRoomType === "__custom__" && (
                <Input
                  placeholder="Type room name…"
                  value={uploadCustomRoom}
                  onChange={(e) => setUploadCustomRoom(e.target.value)}
                  autoFocus
                />
              )}
            </div>
          </div>

          <div className="border-t px-6 py-4 flex gap-2">
            <Button
              className="flex-1"
              disabled={!uploadFile || !uploadProjectId || uploadMutation.isPending || (uploadRoomType === "__custom__" && !uploadCustomRoom.trim())}
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
                value={editRoomType}
                onValueChange={(v) => { setEditRoomType(v); if (v !== "__custom__") setEditCustomRoom(""); }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select room" />
                </SelectTrigger>
                <SelectContent>
                  {allRoomOptions.map((r) => (
                    <SelectItem key={r} value={r}>{r}</SelectItem>
                  ))}
                  <SelectItem value="__custom__">Custom room name…</SelectItem>
                </SelectContent>
              </Select>
              {editRoomType === "__custom__" && (
                <Input
                  placeholder="Type room name…"
                  value={editCustomRoom}
                  onChange={(e) => setEditCustomRoom(e.target.value)}
                  autoFocus
                />
              )}
              <p className="text-xs text-muted-foreground">
                Changing the room will move this render to that group.
              </p>
            </div>
          </div>
          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={() => setEditingRender(null)}>Cancel</Button>
            <Button
              disabled={updateMutation.isPending || (editRoomType === "__custom__" && !editCustomRoom.trim())}
              onClick={() => {
                if (!editingRender) return;
                updateMutation.mutate({
                  id: editingRender.id,
                  name: editName,
                  roomType: effectiveEditRoom,
                });
              }}
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
