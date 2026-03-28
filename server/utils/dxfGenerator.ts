export interface DXFEntity {
  type: "LINE" | "TEXT" | "ARC" | "CIRCLE" | "LWPOLYLINE";
  layer: string;
  x1?: number;
  y1?: number;
  x2?: number;
  y2?: number;
  x?: number;
  y?: number;
  h?: number;
  text?: string;
  cx?: number;
  cy?: number;
  r?: number;
  a1?: number;
  a2?: number;
  points?: Array<[number, number]>;
  closed?: boolean;
}

export interface DXFSpec {
  title: string;
  width_mm: number;
  height_mm: number;
  entities: DXFEntity[];
}

function dxfHeader(spec: DXFSpec): string {
  return [
    "0", "SECTION",
    "2", "HEADER",
    "9", "$ACADVER",
    "1", "AC1015",
    "9", "$INSUNITS",
    "70", "4",
    "9", "$EXTMIN",
    "10", "0.0",
    "20", "0.0",
    "30", "0.0",
    "9", "$EXTMAX",
    "10", String(spec.width_mm),
    "20", String(spec.height_mm),
    "30", "0.0",
    "9", "$LUNITS",
    "70", "4",
    "9", "$MEASUREMENT",
    "70", "1",
    "0", "ENDSEC",
  ].join("\n");
}

function layerEntry(name: string, color: number): string {
  return [
    "0", "LAYER",
    "2", name,
    "70", "0",
    "62", String(color),
    "6", "CONTINUOUS",
  ].join("\n");
}

function dxfTables(): string {
  const layers = [
    layerEntry("Walls", 7),
    layerEntry("InternalWalls", 8),
    layerEntry("Doors", 4),
    layerEntry("Windows", 5),
    layerEntry("Furniture", 3),
    layerEntry("Dimensions", 2),
    layerEntry("Labels", 1),
    layerEntry("Title", 7),
    layerEntry("Hatching", 9),
    layerEntry("Grid", 9),
  ];
  return [
    "0", "SECTION",
    "2", "TABLES",
    "0", "TABLE",
    "2", "LAYER",
    "70", String(layers.length),
    ...layers.flatMap((l) => l.split("\n")),
    "0", "ENDTAB",
    "0", "ENDSEC",
  ].join("\n");
}

function entityLine(e: DXFEntity): string {
  return [
    "0", "LINE",
    "8", e.layer,
    "10", String(e.x1 ?? 0),
    "20", String(e.y1 ?? 0),
    "30", "0.0",
    "11", String(e.x2 ?? 0),
    "21", String(e.y2 ?? 0),
    "31", "0.0",
  ].join("\n");
}

function entityText(e: DXFEntity): string {
  const tx = e.x ?? 0;
  const ty = e.y ?? 0;
  return [
    "0", "TEXT",
    "8", e.layer,
    "10", String(tx),
    "20", String(ty),
    "30", "0.0",
    "40", String(e.h ?? 100),
    "1", e.text ?? "",
    "72", "1",
    "73", "2",
    "11", String(tx),
    "21", String(ty),
    "31", "0.0",
  ].join("\n");
}

function entityArc(e: DXFEntity): string {
  return [
    "0", "ARC",
    "8", e.layer,
    "10", String(e.cx ?? 0),
    "20", String(e.cy ?? 0),
    "30", "0.0",
    "40", String(e.r ?? 100),
    "50", String(e.a1 ?? 0),
    "51", String(e.a2 ?? 90),
  ].join("\n");
}

function entityCircle(e: DXFEntity): string {
  return [
    "0", "CIRCLE",
    "8", e.layer,
    "10", String(e.cx ?? 0),
    "20", String(e.cy ?? 0),
    "30", "0.0",
    "40", String(e.r ?? 50),
  ].join("\n");
}

function entityLWPolyline(e: DXFEntity): string {
  const pts = e.points ?? [];
  const closed = e.closed ? 1 : 0;
  const lines: string[] = [
    "0", "LWPOLYLINE",
    "8", e.layer,
    "90", String(pts.length),
    "70", String(closed),
  ];
  for (const [x, y] of pts) {
    lines.push("10", String(x), "20", String(y));
  }
  return lines.join("\n");
}

function renderEntity(e: DXFEntity): string {
  switch (e.type) {
    case "LINE": return entityLine(e);
    case "TEXT": return entityText(e);
    case "ARC": return entityArc(e);
    case "CIRCLE": return entityCircle(e);
    case "LWPOLYLINE": return entityLWPolyline(e);
    default: return "";
  }
}

export function generateDXF(spec: DXFSpec): string {
  const entitiesSection = [
    "0", "SECTION",
    "2", "ENTITIES",
    ...spec.entities.map(renderEntity).filter(Boolean).flatMap((s) => s.split("\n")),
    "0", "ENDSEC",
  ].join("\n");

  return [
    dxfHeader(spec),
    dxfTables(),
    entitiesSection,
    "0", "EOF",
  ].join("\n");
}
