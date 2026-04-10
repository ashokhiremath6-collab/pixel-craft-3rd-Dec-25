import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, AlertTriangle, Download, ZoomIn, ZoomOut, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

// ─── DXF ACI colour table (abbreviated) ──────────────────────────────────────
const ACI: Record<number, string> = {
  1: "#ff0000", 2: "#ffff00", 3: "#00ff00", 4: "#00ffff",
  5: "#0000ff", 6: "#ff00ff", 7: "#000000", 8: "#808080",
  9: "#c0c0c0", 14: "#008000", 30: "#ff8000", 40: "#804000",
};
function aciColor(c: number | undefined, dark: boolean): string {
  if (!c || c === 0 || c === 256) return dark ? "#e2e8f0" : "#1e293b";
  return ACI[c] || (dark ? "#e2e8f0" : "#1e293b");
}

// ─── Types ────────────────────────────────────────────────────────────────────
type Ent =
  | { k: "LINE"; x1: number; y1: number; x2: number; y2: number; c: number }
  | { k: "CIRCLE"; cx: number; cy: number; r: number; c: number }
  | { k: "ARC"; cx: number; cy: number; r: number; sa: number; ea: number; c: number }
  | { k: "POLY"; pts: { x: number; y: number }[]; closed: boolean; c: number }
  | { k: "TEXT"; x: number; y: number; h: number; txt: string; c: number };

// ─── Parse DXF text into entities ─────────────────────────────────────────────
function parseDxf(raw: string): Ent[] {
  const lines = raw.split(/\r?\n/);
  const entities: Ent[] = [];

  let inEntities = false;
  let i = 0;

  const code = () => parseInt(lines[i]?.trim() ?? "NaN", 10);
  const val = () => lines[i + 1]?.trim() ?? "";
  const num = () => parseFloat(val());
  const advance = () => { i += 2; };

  while (i < lines.length - 1) {
    if (code() === 0 && val() === "SECTION") {
      advance();
      if (code() === 2 && val() === "ENTITIES") { inEntities = true; advance(); continue; }
      if (code() === 2 && val() === "BLOCKS") { inEntities = true; advance(); continue; }
    }
    if (code() === 0 && val() === "ENDSEC") { inEntities = false; advance(); continue; }
    if (!inEntities) { advance(); continue; }

    if (code() !== 0) { advance(); continue; }
    const type = val();
    advance();

    // Collect all group codes for this entity until next code-0
    const props: Record<number, number[]> = {};
    const sProps: Record<number, string[]> = {};
    while (i < lines.length - 1 && code() !== 0) {
      const c = code();
      const v = val();
      const n = parseFloat(v);
      if (!isNaN(n)) { (props[c] = props[c] || []).push(n); }
      else { (sProps[c] = sProps[c] || []).push(v); }
      advance();
    }

    const g = (c: number, idx = 0) => props[c]?.[idx] ?? 0;
    const gs = (c: number, idx = 0) => sProps[c]?.[idx] ?? "";
    const col = g(62);

    if (type === "LINE") {
      entities.push({ k: "LINE", x1: g(10), y1: g(20), x2: g(11), y2: g(21), c: col });
    } else if (type === "CIRCLE") {
      entities.push({ k: "CIRCLE", cx: g(10), cy: g(20), r: g(40), c: col });
    } else if (type === "ARC") {
      entities.push({ k: "ARC", cx: g(10), cy: g(20), r: g(40), sa: g(50), ea: g(51), c: col });
    } else if (type === "LWPOLYLINE") {
      const xs = props[10] || [];
      const ys = props[20] || [];
      const pts = xs.map((x, j) => ({ x, y: ys[j] ?? 0 }));
      const closed = (g(70) & 1) === 1;
      entities.push({ k: "POLY", pts, closed, c: col });
    } else if (type === "TEXT" || type === "MTEXT") {
      const txt = gs(1) || gs(3) || "";
      entities.push({ k: "TEXT", x: g(10), y: g(20), h: g(40) || 2.5, txt, c: col });
    }
  }

  return entities;
}

// ─── Bounding box ─────────────────────────────────────────────────────────────
function bbox(entities: Ent[]) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const expand = (x: number, y: number) => {
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
  };
  for (const e of entities) {
    if (e.k === "LINE") { expand(e.x1, e.y1); expand(e.x2, e.y2); }
    else if (e.k === "CIRCLE") { expand(e.cx - e.r, e.cy - e.r); expand(e.cx + e.r, e.cy + e.r); }
    else if (e.k === "ARC") { expand(e.cx - e.r, e.cy - e.r); expand(e.cx + e.r, e.cy + e.r); }
    else if (e.k === "POLY") { e.pts.forEach(p => expand(p.x, p.y)); }
    else if (e.k === "TEXT") { expand(e.x, e.y); }
  }
  if (!isFinite(minX)) { minX = 0; minY = 0; maxX = 100; maxY = 100; }
  return { minX, minY, maxX, maxY, w: maxX - minX || 1, h: maxY - minY || 1 };
}

// ─── Arc SVG path helper ───────────────────────────────────────────────────────
function arcPath(cx: number, cy: number, r: number, startDeg: number, endDeg: number, flip: (y: number) => number): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  let sa = startDeg, ea = endDeg;
  if (ea < sa) ea += 360;
  const start = { x: cx + r * Math.cos(toRad(sa)), y: flip(cy + r * Math.sin(toRad(sa))) };
  const end = { x: cx + r * Math.cos(toRad(ea)), y: flip(cy + r * Math.sin(toRad(ea))) };
  const large = ea - sa > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${large} 1 ${end.x} ${end.y}`;
}

// ─── Main component ────────────────────────────────────────────────────────────
interface DxfViewerProps {
  fileUrl: string;
  fileName?: string;
  onDownload: () => void;
}

export function DxfViewer({ fileUrl, fileName, onDownload }: DxfViewerProps) {
  const [status, setStatus] = useState<"loading" | "ok" | "empty" | "error">("loading");
  const [entities, setEntities] = useState<Ent[]>([]);
  const [bounds, setBounds] = useState({ minX: 0, minY: 0, w: 100, h: 100, maxX: 100, maxY: 100 });
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  const panStart = useRef({ mx: 0, my: 0, px: 0, py: 0 });
  const dark = document.documentElement.classList.contains("dark");

  useEffect(() => {
    setStatus("loading");
    fetch(fileUrl)
      .then(r => r.text())
      .then(text => {
        const ents = parseDxf(text);
        if (!ents.length) { setStatus("empty"); return; }
        setEntities(ents);
        setBounds(bbox(ents));
        setStatus("ok");
      })
      .catch(() => setStatus("error"));
  }, [fileUrl]);

  const flipY = useCallback((y: number) => bounds.maxY - y + bounds.minY, [bounds]);

  const padding = Math.max(bounds.w, bounds.h) * 0.05;
  const vbX = bounds.minX - padding;
  const vbY = bounds.minY - padding;
  const vbW = bounds.w + padding * 2;
  const vbH = bounds.h + padding * 2;

  const onMouseDown = (e: React.MouseEvent) => {
    setPanning(true);
    panStart.current = { mx: e.clientX, my: e.clientY, px: pan.x, py: pan.y };
  };
  const onMouseMove = (e: React.MouseEvent) => {
    if (!panning) return;
    setPan({ x: panStart.current.px + e.clientX - panStart.current.mx, y: panStart.current.py + e.clientY - panStart.current.my });
  };
  const onMouseUp = () => setPanning(false);
  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.1, Math.min(20, z * (e.deltaY < 0 ? 1.15 : 0.87))));
  };

  const lw = Math.max(bounds.w, bounds.h) * 0.003;

  if (status === "loading") return (
    <div className="flex items-center justify-center h-full">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      <span className="ml-3 text-sm text-muted-foreground">Parsing DXF file…</span>
    </div>
  );

  if (status === "error") return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <p className="font-medium">Could not load this DXF file.</p>
      <p className="text-sm text-muted-foreground">The file may be corrupted or use an unsupported DXF version.</p>
      <Button onClick={onDownload}><Download className="h-4 w-4 mr-2" />Download to open in AutoCAD</Button>
    </div>
  );

  if (status === "empty") return (
    <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
      <AlertTriangle className="h-10 w-10 text-amber-500" />
      <p className="font-medium">No drawable entities found.</p>
      <p className="text-sm text-muted-foreground">This DXF may contain only 3D geometry or unsupported entity types.</p>
      <Button onClick={onDownload}><Download className="h-4 w-4 mr-2" />Download to open in AutoCAD</Button>
    </div>
  );

  const strokeColor = dark ? "#e2e8f0" : "#1e293b";

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b bg-muted/30 shrink-0 flex-wrap">
        <span className="text-xs text-muted-foreground mr-2">
          {entities.length} entities · {(bounds.w).toFixed(0)} × {(bounds.h).toFixed(0)} units
        </span>
        <div className="flex-1" />
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z * 1.25, 20))} title="Zoom in">
          <ZoomIn className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z * 0.8, 0.1))} title="Zoom out">
          <ZoomOut className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }} title="Reset view">
          <RotateCcw className="h-4 w-4" />
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button variant="outline" size="sm" onClick={onDownload}>
          <Download className="h-3.5 w-3.5 mr-1.5" />Download
        </Button>
      </div>

      {/* Canvas */}
      <div
        className="flex-1 overflow-hidden bg-background select-none"
        style={{ cursor: panning ? "grabbing" : "grab" }}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        onMouseLeave={onMouseUp}
        onWheel={onWheel}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`${vbX} ${vbY} ${vbW} ${vbH}`}
          style={{ display: "block", transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: "center" }}
          preserveAspectRatio="xMidYMid meet"
        >
          <rect x={vbX} y={vbY} width={vbW} height={vbH} fill={dark ? "#0f172a" : "#f8fafc"} />
          {entities.map((e, idx) => {
            const col = aciColor(e.c || undefined, dark);
            if (e.k === "LINE") {
              return <line key={idx} x1={e.x1} y1={flipY(e.y1)} x2={e.x2} y2={flipY(e.y2)} stroke={col} strokeWidth={lw} strokeLinecap="round" />;
            }
            if (e.k === "CIRCLE") {
              return <circle key={idx} cx={e.cx} cy={flipY(e.cy)} r={e.r} fill="none" stroke={col} strokeWidth={lw} />;
            }
            if (e.k === "ARC") {
              return <path key={idx} d={arcPath(e.cx, e.cy, e.r, e.sa, e.ea, flipY)} fill="none" stroke={col} strokeWidth={lw} />;
            }
            if (e.k === "POLY") {
              if (!e.pts.length) return null;
              const d = e.pts.map((p, j) => `${j === 0 ? "M" : "L"} ${p.x} ${flipY(p.y)}`).join(" ") + (e.closed ? " Z" : "");
              return <path key={idx} d={d} fill="none" stroke={col} strokeWidth={lw} strokeLinejoin="round" />;
            }
            if (e.k === "TEXT" && e.txt) {
              return (
                <text key={idx} x={e.x} y={flipY(e.y)} fontSize={e.h} fill={col} fontFamily="monospace">
                  {e.txt}
                </text>
              );
            }
            return null;
          })}
        </svg>
      </div>

      <p className="text-center text-xs text-muted-foreground py-1.5 border-t bg-muted/20 shrink-0">
        Scroll to zoom · Drag to pan · LINE, CIRCLE, ARC, LWPOLYLINE, TEXT supported
      </p>
    </div>
  );
}

// ─── DWG warning panel ─────────────────────────────────────────────────────────
interface DwgWarningProps {
  fileName?: string;
  onDownload: () => void;
}

export function DwgWarning({ fileName, onDownload }: DwgWarningProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 p-10 text-center max-w-md mx-auto">
      <div className="w-16 h-16 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-amber-600 dark:text-amber-400" />
      </div>
      <div className="space-y-2">
        <h3 className="font-semibold text-base">AutoCAD Required to Open This File</h3>
        <p className="text-sm text-muted-foreground">
          <strong>.DWG</strong> is AutoCAD's proprietary binary format. It cannot be previewed in the browser.
          You need AutoCAD (or a compatible viewer) installed on your computer to open it.
        </p>
      </div>
      <div className="bg-muted/50 rounded-lg p-4 text-sm text-left space-y-2 w-full">
        <p className="font-medium text-foreground">Free options to view DWG files:</p>
        <ul className="text-muted-foreground space-y-1">
          <li>• <strong>AutoDesk DWG TrueView</strong> — free viewer from Autodesk</li>
          <li>• <strong>eDrawings Viewer</strong> — free, multi-format</li>
          <li>• <strong>LibreCAD</strong> — free open-source CAD app</li>
        </ul>
      </div>
      <Button onClick={onDownload} className="w-full">
        <Download className="h-4 w-4 mr-2" />
        Download {fileName || "DWG File"} to open in AutoCAD
      </Button>
    </div>
  );
}
