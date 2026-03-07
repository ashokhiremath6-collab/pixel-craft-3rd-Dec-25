import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Download, ZoomIn, ZoomOut, RotateCcw, Maximize2, Loader2 } from "lucide-react";
import { openPdf } from "@/lib/fileUtils";

interface FileViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileUrl: string;
  fileName?: string;
}

type FileType = "pdf" | "image" | "text" | "word" | "excel" | "detecting";

function guessTypeFromName(fileName?: string, fileUrl?: string): FileType | null {
  const name = (fileName || fileUrl || "").toLowerCase();
  if (name.endsWith(".pdf") || name.includes(".pdf")) return "pdf";
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp)/.test(name)) return "image";
  if (name.endsWith(".txt")) return "text";
  if (/\.docx?/.test(name)) return "word";
  if (/\.(xlsx?|pptx?)/.test(name)) return "excel";
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

export function FileViewerModal({ isOpen, onClose, fileUrl, fileName }: FileViewerModalProps) {
  const [zoom, setZoom] = useState(100);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [fileType, setFileType] = useState<FileType>("detecting");

  useEffect(() => {
    if (!isOpen || !fileUrl) return;
    setFileType("detecting");
    setTextContent(null);
    setZoom(100);

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

  useEffect(() => {
    if (fileType === "text" && isOpen && fileUrl) {
      fetch(fileUrl)
        .then(res => res.text())
        .then(text => setTextContent(text))
        .catch(() => setTextContent("Unable to load file content"));
    }
  }, [fileType, isOpen, fileUrl]);

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
    setZoom(100);
    onClose();
  };

  const canZoom = fileType === "pdf" || fileType === "image" || fileType === "word";

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

        <div className="flex-1 bg-muted/30" style={{ height: "calc(95vh - 56px)", overflow: "hidden" }}>
          {fileType === "detecting" ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : fileType === "pdf" ? (
            <iframe
              key={zoom}
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&zoom=${zoom}`}
              style={{ width: "100%", height: "100%", border: "none", display: "block" }}
              title={fileName || "PDF viewer"}
              data-testid="file-viewer-pdf"
            />
          ) : fileType === "image" ? (
            <div className="min-h-full flex items-center justify-center p-4">
              <img
                src={fileUrl}
                alt={fileName || "Image viewer"}
                className="max-w-none"
                style={{ transform: `scale(${zoom / 100})`, transformOrigin: "center center" }}
                data-testid="file-viewer-image"
              />
            </div>
          ) : fileType === "text" ? (
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
          ) : fileType === "word" || fileType === "excel" ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <div className="text-center">
                <p className="font-medium mb-1">{fileName}</p>
                <p className="text-sm text-muted-foreground">Click below to download and view this file</p>
              </div>
              <Button onClick={handleDownload} data-testid="button-download-office">
                <Download className="w-4 h-4 mr-2" />
                Download File
              </Button>
            </div>
          ) : (
            <iframe
              src={`${fileUrl}#toolbar=0&navpanes=0&scrollbar=1&view=FitH`}
              className="w-full h-full border-0"
              title={fileName || "File viewer"}
              data-testid="file-viewer-pdf"
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
