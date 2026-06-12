import { useState, useMemo, useRef } from "react";
import { useSearch } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { FileViewerModal } from "@/components/FileViewerModal";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Eye,
  Layers,
  Home,
  Settings2,
  Pencil,
  Trash2,
  Tag,
  Check,
  X,
  Plus,
  AlertCircle,
  Upload,
  Loader2,
  CheckCircle2,
} from "lucide-react";
import { format } from "date-fns";
import type { Project } from "@shared/schema";

// ── Types ────────────────────────────────────────────────────────────────────

type DrawingRevision = {
  id: string;
  drawingId: string;
  revisionLetter: string;
  filePath: string;
  fileName: string;
  fileSize: number;
  fileMimeType: string;
  state: string;
  uploadedBy: string | null;
  uploadedAt: string;
  approvedAt: string | null;
};

type Room = {
  id: string;
  name: string;
  roomType: string;
  displayOrder: number | null;
};

type RoomWithCount = Room & { drawingCount: number };

type DrawingRow = {
  id: string;
  title: string;
  category: string;
  discipline: string;
  drawingNumber: string | null;
  status: string;
  roomId: string | null;
  room: Room | null;
  latestRevision: DrawingRevision | null;
};

// ── Constants ────────────────────────────────────────────────────────────────

const ROOM_TYPES = [
  { value: "bedroom", label: "Bedroom" },
  { value: "bathroom", label: "Bathroom" },
  { value: "kitchen", label: "Kitchen" },
  { value: "living", label: "Living" },
  { value: "dining", label: "Dining" },
  { value: "study", label: "Study" },
  { value: "corridor", label: "Corridor" },
  { value: "lobby", label: "Lobby" },
  { value: "storage", label: "Storage" },
  { value: "utility", label: "Utility" },
  { value: "closet", label: "Closet" },
  { value: "other", label: "Other" },
];

const CATEGORY_ORDER = [
  "Floor Plan", "Reflected Ceiling Plan", "Elevation", "Section",
  "Joinery Detail", "Electrical Layout", "HVAC Layout", "Plumbing Layout",
  "Finishes Schedule", "Furniture Layout", "Specification",
  "Hardware Schedule", "Door & Window Schedule", "BOQ", "Site Plan", "Other",
];

const CATEGORY_COLORS: Record<string, string> = {
  "Floor Plan": "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  "Reflected Ceiling Plan": "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  "Elevation": "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
  "Joinery Detail": "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  "Electrical Layout": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  "HVAC Layout": "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-300",
  "Finishes Schedule": "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-300",
  "Specification": "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300",
};

const STATE_BADGE: Record<string, string> = {
  approved: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  superseded: "bg-muted text-muted-foreground",
  draft: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
  for_review: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Drawing table row ────────────────────────────────────────────────────────

function DrawingTableRow({ drawing, onView, onDelete, onMoveCategory }: {
  drawing: DrawingRow;
  onView: (d: DrawingRow) => void;
  onDelete: (d: DrawingRow) => void;
  onMoveCategory: (d: DrawingRow) => void;
}) {
  const rev = drawing.latestRevision;
  const catColor = CATEGORY_COLORS[drawing.category] || "bg-muted text-muted-foreground";
  const stateColor = rev ? (STATE_BADGE[rev.state] || "bg-muted text-muted-foreground") : "";

  return (
    <TableRow className="hover-elevate cursor-pointer group" onClick={() => onView(drawing)}>
      <TableCell className="font-medium">
        <div className="flex items-center gap-2">
          <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
          <span>{drawing.title}</span>
        </div>
      </TableCell>
      <TableCell>
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${catColor}`}>
          {drawing.category}
        </span>
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{rev ? `Rev ${rev.revisionLetter}` : "—"}</TableCell>
      <TableCell>
        {rev && (
          <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${stateColor}`}>
            {rev.state.replace(/_/g, " ")}
          </span>
        )}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">
        {rev?.uploadedAt ? format(new Date(rev.uploadedAt), "dd MMM yyyy") : "—"}
      </TableCell>
      <TableCell className="text-muted-foreground text-sm">{rev ? formatBytes(rev.fileSize) : "—"}</TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1">
          <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); onView(drawing); }}>
            <Eye className="h-3.5 w-3.5 mr-1.5" />
            Open
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground invisible group-hover:visible"
            title="Change category"
            onClick={(e) => { e.stopPropagation(); onMoveCategory(drawing); }}
          >
            <Tag className="h-3.5 w-3.5" />
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="text-muted-foreground hover:text-destructive invisible group-hover:visible"
            title="Delete drawing"
            onClick={(e) => { e.stopPropagation(); onDelete(drawing); }}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

// ── Collapsible group ────────────────────────────────────────────────────────

function GroupSection({ label, count, drawings, defaultOpen, onView, onDelete, onMoveCategory }: {
  label: string; count: number; drawings: DrawingRow[]; defaultOpen: boolean;
  onView: (d: DrawingRow) => void; onDelete: (d: DrawingRow) => void; onMoveCategory: (d: DrawingRow) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const isEmpty = drawings.length === 0;
  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover-elevate rounded-md mb-1 text-left">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-sm">{label}</span>
            {isEmpty ? (
              <Badge variant="outline" className="no-default-active-elevate text-muted-foreground border-dashed">
                0 drawings
              </Badge>
            ) : (
              <Badge variant="secondary" className="no-default-active-elevate">{count}</Badge>
            )}
          </div>
          {isEmpty && (
            <span className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1">
              <AlertCircle className="h-3.5 w-3.5" />
              No drawings yet
            </span>
          )}
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mb-4">
          {isEmpty ? (
            <div className="flex items-center gap-2 px-6 py-5 text-sm text-muted-foreground border border-dashed rounded-md mx-1 mb-1">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-500" />
              No drawings have been added for this area yet. Upload a drawing to fill this in.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Rev</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {drawings.map((d) => <DrawingTableRow key={d.id} drawing={d} onView={onView} onDelete={onDelete} onMoveCategory={onMoveCategory} />)}
              </TableBody>
            </Table>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

// ── Room row (inside manage panel) ───────────────────────────────────────────

function RoomRow({ room, onSave, onDelete }: {
  room: RoomWithCount;
  onSave: (id: string, name: string, roomType: string) => Promise<void>;
  onDelete: (room: RoomWithCount) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(room.name);
  const [roomType, setRoomType] = useState(room.roomType);
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onSave(room.id, name.trim(), roomType);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setName(room.name);
    setRoomType(room.roomType);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2 py-2 px-1">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="flex-1 h-8 text-sm"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") handleSave(); if (e.key === "Escape") handleCancel(); }}
        />
        <Select value={roomType} onValueChange={setRoomType}>
          <SelectTrigger className="w-32 h-8 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ROOM_TYPES.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="icon" variant="ghost" onClick={handleSave} disabled={saving || !name.trim()} title="Save">
          <Check className="h-4 w-4 text-green-600" />
        </Button>
        <Button size="icon" variant="ghost" onClick={handleCancel} title="Cancel">
          <X className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 py-2 px-1 group rounded-md hover-elevate">
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium truncate">{room.name}</span>
        <span className="ml-2 text-xs text-muted-foreground">{ROOM_TYPES.find(t => t.value === room.roomType)?.label ?? room.roomType}</span>
      </div>
      <Badge variant="secondary" className="no-default-active-elevate shrink-0 text-xs">
        {room.drawingCount} {room.drawingCount === 1 ? "drawing" : "drawings"}
      </Badge>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <Button size="icon" variant="ghost" onClick={() => setEditing(true)} title="Edit">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => onDelete(room)} title="Delete">
          <Trash2 className="h-3.5 w-3.5 text-destructive" />
        </Button>
      </div>
    </div>
  );
}

// ── Add Room form ────────────────────────────────────────────────────────────

function AddRoomForm({ onAdd }: { onAdd: (name: string, roomType: string) => Promise<void> }) {
  const [name, setName] = useState("");
  const [roomType, setRoomType] = useState("other");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    try {
      await onAdd(name.trim(), roomType);
      setName("");
      setRoomType("other");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-3 border-t">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="New room name"
        className="flex-1 h-8 text-sm"
        disabled={saving}
      />
      <Select value={roomType} onValueChange={setRoomType}>
        <SelectTrigger className="w-32 h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROOM_TYPES.map((t) => (
            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" size="icon" variant="default" disabled={saving || !name.trim()} title="Add room">
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

// ── Batch upload dialog ───────────────────────────────────────────────────────

type FileEntry = {
  id: string;
  file: File;
  title: string;
  status: "queued" | "uploading" | "done" | "error";
  errorMsg?: string;
};

function UploadBatchDialog({ open, onOpenChange, rooms, projectId, onComplete }: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  rooms: RoomWithCount[];
  projectId: string;
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [roomId, setRoomId] = useState("__none__");
  const [category, setCategory] = useState("");
  const [revState, setRevState] = useState("draft");
  const [uploading, setUploading] = useState(false);

  function reset() {
    setFiles([]);
    setCategory("");
    setRoomId("__none__");
    setRevState("draft");
  }

  function addFiles(chosen: FileList | null) {
    if (!chosen) return;
    const entries: FileEntry[] = Array.from(chosen).map((f) => ({
      id: Math.random().toString(36).slice(2),
      file: f,
      title: f.name.replace(/\.[^/.]+$/, ""),
      status: "queued",
    }));
    setFiles((prev) => [...prev, ...entries]);
  }

  function removeFile(id: string) {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    addFiles(e.dataTransfer.files);
  }

  async function handleUpload() {
    if (!projectId || !category || files.length === 0) return;
    setUploading(true);
    setFiles((prev) => prev.map((f) => ({ ...f, status: "uploading" as const })));

    const formData = new FormData();
    formData.append("projectId", projectId);
    formData.append("roomId", roomId === "__none__" ? "" : roomId);
    formData.append("category", category);
    formData.append("state", revState);
    formData.append("titles", JSON.stringify(files.map((f) => f.title)));
    files.forEach((entry) => formData.append("files", entry.file));

    try {
      const res = await fetch("/api/working-drawings/upload-batch", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const data = await res.json();

      if (!res.ok) {
        setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const, errorMsg: data.error })));
        toast({ title: "Upload failed", description: data.error, variant: "destructive" });
      } else {
        setFiles((prev) =>
          prev.map((f, i) => ({
            ...f,
            status: data.results[i]?.success ? ("done" as const) : ("error" as const),
            errorMsg: data.results[i]?.error,
          }))
        );
        const succeeded: number = data.results.filter((r: { success: boolean }) => r.success).length;
        const failed: number = data.results.filter((r: { success: boolean }) => !r.success).length;
        toast({
          title: `${succeeded} drawing${succeeded !== 1 ? "s" : ""} uploaded`,
          description: failed > 0 ? `${failed} file${failed !== 1 ? "s" : ""} failed — see list for details` : undefined,
        });
        onComplete();
        if (failed === 0) {
          onOpenChange(false);
          reset();
        }
      }
    } catch {
      setFiles((prev) => prev.map((f) => ({ ...f, status: "error" as const, errorMsg: "Network error" })));
      toast({ title: "Upload failed", description: "Network error — please try again", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  const canUpload = !uploading && files.length > 0 && !!category;

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!uploading) { onOpenChange(v); if (!v) reset(); }
    }}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Drawings</DialogTitle>
          <DialogDescription>
            Each file becomes a new drawing with Revision A. Titles are pre-filled from filenames — edit them before uploading.
          </DialogDescription>
        </DialogHeader>

        {/* Settings */}
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Room / Area</label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger><SelectValue placeholder="Project-Wide" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Project-Wide</SelectItem>
                {rooms.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">
              Category <span className="text-destructive">*</span>
            </label>
            <Input
              list="drawing-categories"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="Select or type a category…"
            />
            <datalist id="drawing-categories">
              {CATEGORY_ORDER.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-medium">State</label>
            <Select value={revState} onValueChange={setRevState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="for_review">For Review</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Drop zone */}
        {!uploading && (
          <div
            className="border-2 border-dashed rounded-md px-6 py-8 text-center cursor-pointer hover-elevate"
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <Upload className="h-7 w-7 mx-auto mb-2 text-muted-foreground/60" />
            <p className="text-sm font-medium">Click to choose files or drag &amp; drop</p>
            <p className="text-xs text-muted-foreground mt-1">PDF, DWG, DXF, PNG, JPG — up to 30 files, 100 MB each</p>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.dwg,.dxf,.png,.jpg,.jpeg"
              className="hidden"
              onChange={(e) => addFiles(e.target.files)}
            />
          </div>
        )}

        {/* File list */}
        {files.length > 0 && (
          <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
            {files.map((entry, i) => (
              <div key={entry.id} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-5 shrink-0 text-right">{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  {entry.status === "queued" ? (
                    <Input
                      value={entry.title}
                      onChange={(e) =>
                        setFiles((prev) =>
                          prev.map((f) => f.id === entry.id ? { ...f, title: e.target.value } : f)
                        )
                      }
                      className="h-8 text-sm"
                      placeholder="Drawing title"
                    />
                  ) : (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 text-sm">
                      {entry.status === "uploading" && <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0 text-muted-foreground" />}
                      {entry.status === "done" && <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-green-500" />}
                      {entry.status === "error" && <AlertCircle className="h-3.5 w-3.5 shrink-0 text-destructive" />}
                      <span className="truncate">{entry.title || entry.file.name}</span>
                      {entry.errorMsg && (
                        <span className="text-xs text-destructive ml-auto shrink-0">{entry.errorMsg}</span>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-xs text-muted-foreground shrink-0 w-14 text-right">
                  {formatBytes(entry.file.size)}
                </span>
                {entry.status === "queued" && (
                  <Button size="icon" variant="ghost" onClick={() => removeFile(entry.id)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => { onOpenChange(false); reset(); }} disabled={uploading}>
            Cancel
          </Button>
          <Button onClick={handleUpload} disabled={!canUpload}>
            {uploading ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading…</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" />Upload {files.length > 0 ? `${files.length} file${files.length !== 1 ? "s" : ""}` : "Drawings"}</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function WorkingDrawingsPage() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const filterProjectId = params.get("projectId") || "";

  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"room" | "category">("room");
  const [viewingDrawing, setViewingDrawing] = useState<DrawingRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; name: string } | null>(null);
  const [manageOpen, setManageOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingRoom, setDeletingRoom] = useState<RoomWithCount | null>(null);
  const [deletingDrawing, setDeletingDrawing] = useState<DrawingRow | null>(null);
  const [movingDrawing, setMovingDrawing] = useState<DrawingRow | null>(null);
  const [newCategory, setNewCategory] = useState("");

  const { data: projects = [] } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const activeProjectId = filterProjectId || (projects[0]?.id ?? "");

  const roomsKey = ["/api/working-drawings/rooms", activeProjectId];
  const drawingsKey = ["/api/working-drawings", activeProjectId, searchText];

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<RoomWithCount[]>({
    queryKey: roomsKey,
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/working-drawings/rooms?projectId=${encodeURIComponent(activeProjectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
    enabled: !!activeProjectId,
  });

  const { data: allDrawings = [], isLoading: drawingsLoading } = useQuery<DrawingRow[]>({
    queryKey: drawingsKey,
    queryFn: async () => {
      if (!activeProjectId) return [];
      const sp = new URLSearchParams({ projectId: activeProjectId });
      if (searchText) sp.set("search", searchText);
      const res = await fetch(`/api/working-drawings?${sp}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch drawings");
      return res.json();
    },
    enabled: !!activeProjectId,
  });

  const isLoading = roomsLoading || drawingsLoading;

  // ── Room CRUD mutations ────────────────────────────────────────────────────

  const createRoomMut = useMutation({
    mutationFn: async ({ name, roomType }: { name: string; roomType: string }) => {
      const res = await fetch("/api/working-drawings/rooms", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: activeProjectId, name, roomType }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to create room");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey });
      toast({ title: "Room added" });
    },
    onError: (err: Error) => toast({ title: "Could not add room", description: err.message, variant: "destructive" }),
  });

  const updateRoomMut = useMutation({
    mutationFn: async ({ id, name, roomType }: { id: string; name: string; roomType: string }) => {
      const res = await fetch(`/api/working-drawings/rooms/${id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, roomType }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update room");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey });
      qc.invalidateQueries({ queryKey: ["/api/working-drawings", activeProjectId] });
      toast({ title: "Room updated" });
    },
    onError: (err: Error) => toast({ title: "Could not update room", description: err.message, variant: "destructive" }),
  });

  const deleteRoomMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/working-drawings/rooms/${id}?projectId=${encodeURIComponent(activeProjectId)}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete room");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: roomsKey });
      toast({ title: "Room deleted" });
      setDeletingRoom(null);
    },
    onError: (err: Error) => {
      toast({ title: "Cannot delete room", description: err.message, variant: "destructive" });
      setDeletingRoom(null);
    },
  });

  const deleteDrawingMut = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiRequest("DELETE", `/api/working-drawings/${id}`);
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to delete drawing");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drawingsKey });
      qc.invalidateQueries({ queryKey: roomsKey });
      toast({ title: "Drawing deleted" });
      setDeletingDrawing(null);
    },
    onError: (err: Error) => {
      toast({ title: "Could not delete drawing", description: err.message, variant: "destructive" });
      setDeletingDrawing(null);
    },
  });

  const moveCategoryMut = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const res = await apiRequest("PATCH", `/api/working-drawings/${id}`, { category });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Failed to update category");
      return body;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: drawingsKey });
      toast({ title: "Category updated" });
      setMovingDrawing(null);
    },
    onError: (err: Error) => {
      toast({ title: "Could not update category", description: err.message, variant: "destructive" });
    },
  });

  async function handleAddRoom(name: string, roomType: string) {
    await createRoomMut.mutateAsync({ name, roomType });
  }

  async function handleSaveRoom(id: string, name: string, roomType: string) {
    await updateRoomMut.mutateAsync({ id, name, roomType });
  }

  function handleDeleteRoom(room: RoomWithCount) {
    setDeletingRoom(room);
  }

  async function confirmDelete() {
    if (!deletingRoom) return;
    await deleteRoomMut.mutateAsync(deletingRoom.id);
  }

  // ── Grouping ───────────────────────────────────────────────────────────────

  const groupedByRoom = useMemo(() => {
    // Seed every room first so empty rooms always appear
    const roomMap = new Map<string, { label: string; drawings: DrawingRow[] }>(
      rooms.map((r) => [r.id, { label: r.name, drawings: [] }])
    );
    const noRoom: DrawingRow[] = [];
    for (const d of allDrawings) {
      if (d.room) {
        if (!roomMap.has(d.room.id)) roomMap.set(d.room.id, { label: d.room.name, drawings: [] });
        roomMap.get(d.room.id)!.drawings.push(d);
      } else {
        noRoom.push(d);
      }
    }
    const roomOrder = rooms.map((r) => r.id);
    const sorted = Array.from(roomMap.entries()).sort(([a], [b]) => {
      const ia = roomOrder.indexOf(a), ib = roomOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    const result: { key: string; label: string; drawings: DrawingRow[] }[] = sorted.map(([k, v]) => ({ key: k, label: v.label, drawings: v.drawings }));
    if (noRoom.length > 0) result.push({ key: "__none__", label: "Project-Wide", drawings: noRoom });
    return result;
  }, [allDrawings, rooms]);

  const groupedByCategory = useMemo(() => {
    const catMap = new Map<string, DrawingRow[]>();
    for (const d of allDrawings) {
      if (!catMap.has(d.category)) catMap.set(d.category, []);
      catMap.get(d.category)!.push(d);
    }
    const sorted = Array.from(catMap.entries()).sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a), ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sorted.map(([cat, drws]) => ({ key: cat, label: cat, drawings: drws }));
  }, [allDrawings]);

  const activeProject = projects.find((p) => p.id === activeProjectId);
  const groups = viewMode === "room" ? groupedByRoom : groupedByCategory;

  // ── View handler ───────────────────────────────────────────────────────────

  async function handleView(drawing: DrawingRow) {
    if (!drawing.latestRevision) {
      toast({ title: "No file available", description: "This drawing has no uploaded revision yet.", variant: "destructive" });
      return;
    }
    try {
      const res = await apiRequest("GET", `/api/working-drawings/${drawing.id}/view-url/${drawing.latestRevision.id}`);
      const data = await res.json();
      setViewingDrawing(drawing);
      setViewerUrl({ url: data.url, name: data.fileName });
    } catch {
      toast({ title: "Could not open file", description: "Try again in a moment.", variant: "destructive" });
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Working Drawings</h1>
            {activeProject && <p className="text-sm text-muted-foreground mt-0.5">{activeProject.projectName}</p>}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project selector */}
            {projects.length > 1 && (
              <Select value={activeProjectId} onValueChange={(v) => {
                const p = new URLSearchParams(search);
                p.set("projectId", v);
                window.history.replaceState(null, "", `?${p}`);
              }}>
                <SelectTrigger className="w-48"><SelectValue placeholder="Select project" /></SelectTrigger>
                <SelectContent>
                  {projects.map((p) => <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {/* Upload drawings */}
            {activeProjectId && (
              <Button onClick={() => setUploadOpen(true)} className="gap-1.5">
                <Upload className="h-4 w-4" />
                Upload Drawings
              </Button>
            )}

            {/* Manage rooms */}
            {activeProjectId && (
              <Button variant="outline" onClick={() => setManageOpen(true)} className="gap-1.5">
                <Settings2 className="h-4 w-4" />
                Manage Rooms
              </Button>
            )}

            {/* View mode toggle */}
            <div className="flex items-center rounded-md border overflow-hidden">
              <button
                onClick={() => setViewMode("room")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "room" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate"}`}
              >
                <Home className="h-3.5 w-3.5" />
                By Room
              </button>
              <button
                onClick={() => setViewMode("category")}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-sm transition-colors ${viewMode === "category" ? "bg-primary text-primary-foreground" : "bg-background text-muted-foreground hover-elevate"}`}
              >
                <Layers className="h-3.5 w-3.5" />
                By Category
              </button>
            </div>

            {/* Search — title · room name · category */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 w-56"
                placeholder="Title, room or category…"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* Summary pills */}
        {!isLoading && allDrawings.length > 0 && (
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <span className="text-sm text-muted-foreground">{allDrawings.length} drawings</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-sm text-muted-foreground">{rooms.length} rooms</span>
            {viewMode === "category" && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-sm text-muted-foreground">{groupedByCategory.length} categories</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {!activeProjectId ? (
          <div className="flex items-center justify-center h-64 text-muted-foreground">
            <p>Select a project to view drawings.</p>
          </div>
        ) : isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)}
          </div>
        ) : groups.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="font-medium">No drawings found</p>
              {searchText && <p className="text-sm">Try a different search term.</p>}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {groups.map((group, idx) => (
              <GroupSection key={group.key} label={group.label} count={group.drawings.length}
                drawings={group.drawings} defaultOpen={idx === 0 && group.drawings.length > 0}
                onView={handleView}
                onDelete={(d) => setDeletingDrawing(d)}
                onMoveCategory={(d) => { setMovingDrawing(d); setNewCategory(d.category); }} />
            ))}
          </div>
        )}
      </div>

      {/* Manage Rooms Sheet */}
      <Sheet open={manageOpen} onOpenChange={setManageOpen}>
        <SheetContent side="right" className="w-[420px] flex flex-col gap-0 p-0">
          <SheetHeader className="px-6 py-4 border-b">
            <SheetTitle>Manage Rooms</SheetTitle>
            {activeProject && <p className="text-sm text-muted-foreground">{activeProject.projectName}</p>}
          </SheetHeader>
          <div className="flex-1 overflow-auto px-6 py-4">
            {rooms.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No rooms yet.</p>
            ) : (
              <div className="divide-y">
                {rooms.map((room) => (
                  <RoomRow
                    key={room.id}
                    room={room}
                    onSave={handleSaveRoom}
                    onDelete={handleDeleteRoom}
                  />
                ))}
              </div>
            )}
          </div>
          <div className="px-6 pb-6">
            <AddRoomForm onAdd={handleAddRoom} />
          </div>
        </SheetContent>
      </Sheet>

      {/* Delete confirmation */}
      <AlertDialog open={!!deletingRoom} onOpenChange={(o) => { if (!o) setDeletingRoom(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingRoom && deletingRoom.drawingCount > 0
                ? "Cannot delete room"
                : `Delete "${deletingRoom?.name}"?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deletingRoom && deletingRoom.drawingCount > 0
                ? `This room has ${deletingRoom.drawingCount} drawing${deletingRoom.drawingCount === 1 ? "" : "s"} — move or remove them first.`
                : "This room has no drawings. It will be permanently deleted."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>
              {deletingRoom && deletingRoom.drawingCount > 0 ? "Close" : "Cancel"}
            </AlertDialogCancel>
            {deletingRoom && deletingRoom.drawingCount === 0 && (
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground"
                onClick={confirmDelete}
                disabled={deleteRoomMut.isPending}
              >
                Delete room
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change category dialog */}
      <Dialog open={!!movingDrawing} onOpenChange={(o) => { if (!o) setMovingDrawing(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Change category</DialogTitle>
            <DialogDescription>
              Move <span className="font-medium text-foreground">"{movingDrawing?.title}"</span> to a different category.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-2">
            <label className="text-sm font-medium">New category</label>
            <Input
              list="move-drawing-categories"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Select or type a category…"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newCategory.trim() && movingDrawing) {
                  moveCategoryMut.mutate({ id: movingDrawing.id, category: newCategory.trim() });
                }
              }}
            />
            <datalist id="move-drawing-categories">
              {CATEGORY_ORDER.map((c) => <option key={c} value={c} />)}
            </datalist>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovingDrawing(null)}>Cancel</Button>
            <Button
              onClick={() => {
                if (movingDrawing && newCategory.trim()) {
                  moveCategoryMut.mutate({ id: movingDrawing.id, category: newCategory.trim() });
                }
              }}
              disabled={!newCategory.trim() || newCategory === movingDrawing?.category || moveCategoryMut.isPending}
            >
              {moveCategoryMut.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" /> : null}
              Move
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Drawing delete confirmation */}
      <AlertDialog open={!!deletingDrawing} onOpenChange={(o) => { if (!o) setDeletingDrawing(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deletingDrawing?.title}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the drawing and all its revisions. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground"
              onClick={() => { if (deletingDrawing) deleteDrawingMut.mutate(deletingDrawing.id); }}
              disabled={deleteDrawingMut.isPending}
            >
              Delete drawing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Batch upload */}
      <UploadBatchDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        rooms={rooms}
        projectId={activeProjectId}
        onComplete={() => {
          qc.invalidateQueries({ queryKey: drawingsKey });
          qc.invalidateQueries({ queryKey: roomsKey });
        }}
      />

      {/* PDF Viewer */}
      {viewingDrawing && viewerUrl && (
        <FileViewerModal
          isOpen
          onClose={() => { setViewingDrawing(null); setViewerUrl(null); }}
          fileUrl={viewerUrl.url}
          fileName={viewerUrl.name}
        />
      )}
    </div>
  );
}
