import { useState, useEffect, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Loader2 } from "lucide-react";
import { openPdf } from "@/lib/fileUtils";
import { DxfViewer, DwgWarning } from "@/components/DxfViewer";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
  defaultZoom?: number;
}

type FileType = "pdf" | "image" | "text" | "word" | "excel" | "cad-dxf" | "cad-dwg" | "detecting";

function guessTypeFromName(fileName?: string, fileUrl?: string): FileType | null {
  const name = (fileName || fileUrl || "").toLowerCase();
  if (name.endsWith(".pdf") || name.includes(".pdf")) return "pdf";
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)/.test(name)) return "image";
  if (name.endsWith(".txt")) return "text";
  if (/\.docx?/.test(name)) return "word";
  if (/\.(xlsx?|pptx?)/.test(name)) return "excel";
  if (name.endsWith(".dxf")) return "cad-dxf";
  if (name.endsWith(".dwg")) return "cad-dwg";
  return null;
}

function contentTypeToFileType(ct: string): FileType {
  if (ct.includes("pdf")) return "pdf";
  if (ct.startsWith("image/")) return "image";
  if (ct.includes("text/plain")) return "text";
  if (ct.includes("word") || ct.includes("officedocument.wordprocessing")) return "word";
  if (ct.includes("spreadsheet") || ct.includes("excel") || ct.includes("presentation") || ct.includes("powerpoint")) return "excel";
  return "pdf";
}

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName, defaultZoom = 100 }: FileViewerModalProps) {
  const [zoom, setZoom] = useState(defaultZoom);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>("detecting");
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [blobLoading, setBlobLoading] = useState(false);
  const [blobError, setBlobError] = useState(false);
  const [sheetHtml, setSheetHtml] = useState<string | null>(null);
  const [sheetLoading, setSheetLoading] = useState(false);
  const [sheetError, setSheetError] = useState(false);
  const prevBlobUrl = useRef<string | null>(null);

  const revokePrev = () => {
    if (prevBlobUrl.current) {
      URL.revokeObjectURL(prevBlobUrl.current);
      prevBlobUrl.current = null;
    }
  };

  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    setFileType("detecting");
    setTextContent(null);
    setZoom(defaultZoom);
    setBlobUrl(null);
    setBlobError(false);
    setSheetHtml(null);
    setSheetError(false);
    revokePrev();

    const guessed = guessTypeFromName(fileName, fileUrl);
    if (guessed) {
      setFileType(guessed);
      return;
    }

    fetch(fileUrl, { method: "HEAD" })
      .then(res => {
        const ct = res.ok ? (res.headers.get("content-type") || "") : "";
        setFileType(contentTypeToFileType(ct));
      })
      .catch(() => setFileType("pdf"));
  }, [isOpen, fileUrl, fileName]);

  // Fetch blob for image types only; PDFs stream directly via their URL
  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    if (fileType !== "image") return;

    revokePrev();
    setBlobUrl(null);
    setBlobLoading(true);
    setBlobError(false);

    fetch(fileUrl)
      .then(res => {
        if (!res.ok) throw new Error("fetch failed");
        return res.blob();
      })
      .then(blob => {
        const url = URL.createObjectURL(blob);
        prevBlobUrl.current = url;
        setBlobUrl(url);
        setBlobLoading(false);
      })
      .catch(() => {
        setBlobError(true);
        setBlobLoading(false);
      });
  }, [isOpen, fileUrl, fileType]);

  // Parse Excel files client-side with SheetJS
  useEffect(() => {
    if (!isOpen || !fileUrl || fileType !== "excel") return;
    setSheetHtml(null);
    setSheetLoading(true);
    setSheetError(false);

    (async () => {
      try {
        const XLSX = await import("xlsx");
        const res = await fetch(fileUrl);
        if (!res.ok) throw new Error("fetch failed");
        const arrayBuffer = await res.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array" });
        const firstSheet = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheet];
        const html = XLSX.utils.sheet_to_html(worksheet, { id: "xlsx-table", editable: false });
        setSheetHtml(html);
        setSheetLoading(false);
      } catch {
        setSheetError(true);
        setSheetLoading(false);
      }
    })();
  }, [isOpen, fileUrl, fileType]);

  // Text content fetch
  useEffect(() => {
    if (fileType === "text" && isOpen && fileUrl) {
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => setTextContent(text))
        .catch(() => setTextContent("Unable to load file content"));
    }
  }, [fileType, isOpen, fileUrl]);

  // Cleanup blob URL when modal closes
  useEffect(() => {
    if (!isOpen) {
      revokePrev();
      setBlobUrl(null);
    }
  }, [isOpen]);

  const handleDownload = () => {
    const link = document.createElement("a");
    link.href = fileUrl;
    link.download = fileName || "download";
    link.click();
  };

  const handleOpenExternal = () => {
    if (fileType === "pdf") {
      openPdf(fileUrl);
    } else {
      window.open(fileUrl, "_blank", "noopener,noreferrer");
    }
  };

  const handleClose = () => {
    setZoom(defaultZoom);
    onClose();
  };

  const canZoom = fileType === "pdf" || fileType === "image" || fileType === "word";
  const isCad = fileType === "cad-dxf" || fileType === "cad-dwg";

  const renderBody = () => {
    if (fileType === "cad-dxf") {
      return <DxfViewer fileUrl={fileUrl} fileName={fileName} onDownload={handleDownload} />;
    }
    if (fileType === "cad-dwg") {
      return <DwgWarning fileName={fileName} onDownload={handleDownload} />;
    }
    if (fileType === "detecting") {
      return (
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (fileType === "pdf") {
      return (
        <iframe
          key={`${fileUrl}-${zoom}`}
          src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`}
          style={{ width: "100%", height: "100%", border: "none", display: "block" }}
          title={fileName || "PDF viewer"}
          data-testid="file-viewer-pdf"
        />
      );
    }
    if (fileType === "image") {
      const src = blobUrl || fileUrl;
      return (
        <div style={{
          width: "100%",
          height: "100%",
          overflow: "auto",
          display: "flex",
          alignItems: zoom <= 100 ? "center" : "flex-start",
          justifyContent: zoom <= 100 ? "center" : "flex-start",
        }}>
          <div style={{
            width: zoom > 100 ? `${zoom}%` : "100%",
            height: zoom > 100 ? `${zoom}%` : "100%",
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}>
            <img
              src={src}
              alt={fileName || "Image viewer"}
              style={{ width: "100%", height: "100%", objectFit: "contain", display: "block" }}
              data-testid="file-viewer-image"
            />
          </div>
        </div>
      );
    }
    if (fileType === "text") {
      return (
        <div className="p-4 h-full overflow-auto">
          {textContent === null ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <pre className="whitespace-pre-wrap break-words text-sm font-mono bg-background p-4 rounded-md" data-testid="file-viewer-text">
              {textContent}
            </pre>
          )}
        </div>
      );
    }
    if (fileType === "excel") {
      if (sheetLoading) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading spreadsheet…</p>
          </div>
        );
      }
      if (sheetError || !sheetHtml) {
        return (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
            <p className="text-sm text-muted-foreground">Could not display this file inline.</p>
            <Button onClick={handleDownload} data-testid="button-download-office">
              <Download className="w-4 h-4 mr-2" />
              Download File
            </Button>
          </div>
        );
      }
      return (
        <div
          className="w-full h-full overflow-auto p-4 bg-white"
          data-testid="file-viewer-excel"
          dangerouslySetInnerHTML={{ __html: `<style>
            #xlsx-table { border-collapse: collapse; font-size: 13px; font-family: Arial, sans-serif; min-width: 100%; }
            #xlsx-table td, #xlsx-table th { border: 1px solid #d0d0d0; padding: 4px 8px; white-space: nowrap; }
            #xlsx-table tr:first-child td, #xlsx-table tr:first-child th { background: #f0f0f0; font-weight: 600; }
            #xlsx-table tr:nth-child(even) td { background: #fafafa; }
          </style>${sheetHtml}` }}
        />
      );
    }
    if (fileType === "word") {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <Download className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <p className="font-medium mb-1">{fileName}</p>
            <p className="text-sm text-muted-foreground">Word documents cannot be previewed inline.</p>
          </div>
          <Button onClick={handleDownload} data-testid="button-download-office">
            <Download className="w-4 h-4 mr-2" />
            Download File
          </Button>
        </div>
      );
    }
    return (
      <iframe
        src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
        className="w-full h-full border-0"
        title={fileName || "File viewer"}
        data-testid="file-viewer-pdf"
      />
    );
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] w-full h-full p-0">
        <DialogHeader className="p-3 border-b bg-background">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-sm truncate flex-1" data-testid="viewer-file-name">
              {fileName || "File Viewer"}
            </DialogTitle>
            <div className="flex items-center gap-1">
              {canZoom && (
                <>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.max(z - 25, 25))} disabled={zoom <= 25} data-testid="button-zoom-out">
                    <ZoomOut className="w-4 h-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground min-w-[3rem] text-center">{zoom}%</span>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(z => Math.min(z + 25, 500))} disabled={zoom >= 500} data-testid="button-zoom-in">
                    <ZoomIn className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(100)} data-testid="button-reset-zoom">
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => setZoom(100)} data-testid="button-fit-width">
                    <Maximize2 className="w-4 h-4" />
                  </Button>
                  <div className="w-px h-6 bg-border mx-1" />
                </>
              )}
              <Button variant="ghost" size="icon" onClick={handleOpenExternal} title="Open in new tab" data-testid="button-open-external">
                <ExternalLink className="w-4 h-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={handleDownload} title="Download file" data-testid="button-download-file">
                <Download className="w-4 h-4" />
              </Button>
              <Button variant="destructive" size="sm" onClick={handleClose} className="ml-2" data-testid="button-close-viewer">
                <X className="w-4 h-4 mr-1" />
                Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex-1 bg-muted/30" style={{ height: "calc(95vh - 56px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {renderBody()}
        </div>
      </DialogContent>
    </Dialog>
  );
}
