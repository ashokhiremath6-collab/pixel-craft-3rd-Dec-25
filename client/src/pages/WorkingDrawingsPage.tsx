import { useState, useMemo } from "react";
import { useSearch } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
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
import { FileViewerModal } from "@/components/FileViewerModal";
import { useToast } from "@/hooks/use-toast";
import {
  Search,
  ChevronDown,
  ChevronRight,
  FileText,
  Eye,
  Download,
  LayoutGrid,
  List,
  Layers,
  Home,
} from "lucide-react";
import { format } from "date-fns";
import type { Project } from "@shared/schema";

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

type RoomWithCount = Room & { drawingCount: number };

const CATEGORY_ORDER = [
  "Floor Plan",
  "Reflected Ceiling Plan",
  "Elevation",
  "Section",
  "Joinery Detail",
  "Electrical Layout",
  "HVAC Layout",
  "Plumbing Layout",
  "Finishes Schedule",
  "Furniture Layout",
  "Specification",
  "Hardware Schedule",
  "Door & Window Schedule",
  "BOQ",
  "Site Plan",
  "Other",
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

function DrawingTableRow({
  drawing,
  onView,
}: {
  drawing: DrawingRow;
  onView: (drawing: DrawingRow) => void;
}) {
  const rev = drawing.latestRevision;
  const catColor = CATEGORY_COLORS[drawing.category] || "bg-muted text-muted-foreground";
  const stateColor = rev ? (STATE_BADGE[rev.state] || "bg-muted text-muted-foreground") : "";

  return (
    <TableRow
      className="hover-elevate cursor-pointer group"
      onClick={() => onView(drawing)}
    >
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
      <TableCell className="text-muted-foreground text-sm">
        {rev ? `Rev ${rev.revisionLetter}` : "—"}
      </TableCell>
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
      <TableCell className="text-muted-foreground text-sm">
        {rev ? formatBytes(rev.fileSize) : "—"}
      </TableCell>
      <TableCell className="text-right">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            size="icon"
            variant="ghost"
            onClick={(e) => { e.stopPropagation(); onView(drawing); }}
            title="View PDF"
          >
            <Eye className="h-4 w-4" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );
}

function GroupSection({
  label,
  count,
  drawings,
  defaultOpen,
  onView,
}: {
  label: string;
  count: number;
  drawings: DrawingRow[];
  defaultOpen: boolean;
  onView: (d: DrawingRow) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover-elevate rounded-md mb-1 text-left">
          <div className="flex items-center gap-2">
            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <span className="font-medium text-sm">{label}</span>
            <Badge variant="secondary" className="no-default-active-elevate">{count}</Badge>
          </div>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mb-4">
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
              {drawings.map((d) => (
                <DrawingTableRow key={d.id} drawing={d} onView={onView} />
              ))}
            </TableBody>
          </Table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

export default function WorkingDrawingsPage() {
  const { toast } = useToast();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const filterProjectId = params.get("projectId") || "";

  const [searchText, setSearchText] = useState("");
  const [viewMode, setViewMode] = useState<"room" | "category">("room");
  const [viewingDrawing, setViewingDrawing] = useState<DrawingRow | null>(null);
  const [viewerUrl, setViewerUrl] = useState<{ url: string; name: string } | null>(null);
  const [loadingViewId, setLoadingViewId] = useState<string | null>(null);

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const activeProjectId = filterProjectId || (projects[0]?.id ?? "");

  const { data: rooms = [], isLoading: roomsLoading } = useQuery<RoomWithCount[]>({
    queryKey: ["/api/working-drawings/rooms", activeProjectId],
    queryFn: async () => {
      if (!activeProjectId) return [];
      const res = await fetch(`/api/working-drawings/rooms?projectId=${encodeURIComponent(activeProjectId)}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch rooms");
      return res.json();
    },
    enabled: !!activeProjectId,
  });

  const { data: allDrawings = [], isLoading: drawingsLoading } = useQuery<DrawingRow[]>({
    queryKey: ["/api/working-drawings", activeProjectId, searchText],
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

  const groupedByRoom = useMemo(() => {
    const roomMap = new Map<string, { label: string; drawings: DrawingRow[] }>();
    const noRoom: DrawingRow[] = [];

    for (const d of allDrawings) {
      if (d.room) {
        if (!roomMap.has(d.room.id)) {
          roomMap.set(d.room.id, { label: d.room.name, drawings: [] });
        }
        roomMap.get(d.room.id)!.drawings.push(d);
      } else {
        noRoom.push(d);
      }
    }

    const roomOrder = rooms.map((r) => r.id);
    const sorted = Array.from(roomMap.entries()).sort(([a], [b]) => {
      const ia = roomOrder.indexOf(a);
      const ib = roomOrder.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });

    const result: { key: string; label: string; drawings: DrawingRow[] }[] = sorted.map(([k, v]) => ({
      key: k,
      label: v.label,
      drawings: v.drawings,
    }));
    if (noRoom.length > 0) {
      result.push({ key: "__none__", label: "Project-Wide", drawings: noRoom });
    }
    return result;
  }, [allDrawings, rooms]);

  const groupedByCategory = useMemo(() => {
    const catMap = new Map<string, DrawingRow[]>();
    for (const d of allDrawings) {
      if (!catMap.has(d.category)) catMap.set(d.category, []);
      catMap.get(d.category)!.push(d);
    }
    const sorted = Array.from(catMap.entries()).sort(([a], [b]) => {
      const ia = CATEGORY_ORDER.indexOf(a);
      const ib = CATEGORY_ORDER.indexOf(b);
      return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
    });
    return sorted.map(([cat, drawings]) => ({ key: cat, label: cat, drawings }));
  }, [allDrawings]);

  const activeProject = projects.find((p) => p.id === activeProjectId);

  async function handleView(drawing: DrawingRow) {
    if (!drawing.latestRevision) {
      toast({ title: "No file available", description: "This drawing has no uploaded revision yet.", variant: "destructive" });
      return;
    }
    setLoadingViewId(drawing.id);
    try {
      const res = await apiRequest("GET", `/api/working-drawings/${drawing.id}/view-url/${drawing.latestRevision.id}`);
      const data = await res.json();
      setViewingDrawing(drawing);
      setViewerUrl({ url: data.url, name: data.fileName });
    } catch {
      toast({ title: "Could not open file", description: "Try again in a moment.", variant: "destructive" });
    } finally {
      setLoadingViewId(null);
    }
  }

  const groups = viewMode === "room" ? groupedByRoom : groupedByCategory;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b bg-background px-6 py-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-lg font-semibold">Working Drawings</h1>
            {activeProject && (
              <p className="text-sm text-muted-foreground mt-0.5">{activeProject.projectName}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Project selector */}
            {projects.length > 1 && (
              <Select value={activeProjectId} onValueChange={(v) => {
                const p = new URLSearchParams(search);
                p.set("projectId", v);
                window.history.replaceState(null, "", `?${p}`);
              }}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select project" />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.projectName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
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

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                className="pl-8 w-56"
                placeholder="Search drawings…"
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
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))}
          </div>
        ) : allDrawings.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
              <FileText className="h-10 w-10 opacity-30" />
              <p className="font-medium">No drawings found</p>
              {searchText && (
                <p className="text-sm">Try a different search term.</p>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1">
            {groups.map((group, idx) => (
              <GroupSection
                key={group.key}
                label={group.label}
                count={group.drawings.length}
                drawings={group.drawings}
                defaultOpen={idx === 0}
                onView={handleView}
              />
            ))}
          </div>
        )}
      </div>

      {/* PDF Viewer Modal */}
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
