import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Building2,
  FileText,
  Upload,
  LogOut,
  ChevronRight,
  FolderOpen,
  Download,
  Clock,
  CheckCircle2,
} from "lucide-react";

interface VendorInfo {
  id: string;
  name: string;
  category?: string;
}

interface ProjectSummary {
  projectId: string;
  projectName: string;
  clientName: string | null;
  quoteFiles: QuoteFile[];
}

interface QuoteFile {
  id: string;
  fileName: string;
  objectPath: string;
  uploadedAt: string;
  uploadedByName: string | null;
}

export default function VendorPortalApp() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const [selectedProject, setSelectedProject] = useState<ProjectSummary | null>(null);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

  const { data: vendorInfo, isLoading: vendorLoading } = useQuery<VendorInfo>({
    queryKey: ["/api/vendor-portal/me"],
  });

  const { data: projects, isLoading: projectsLoading } = useQuery<ProjectSummary[]>({
    queryKey: ["/api/vendor-portal/projects"],
  });

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProject) return;

    const formData = new FormData();
    formData.append("quoteFile", file);
    setUploading(true);
    try {
      const res = await fetch(`/api/vendor-portal/${selectedProject.projectId}/upload`, {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Upload failed");
      }
      await queryClient.invalidateQueries({ queryKey: ["/api/vendor-portal/projects"] });
      toast({ title: "File uploaded", description: `${file.name} has been submitted.` });
      setUploadDialogOpen(false);
      // Refresh selected project data
      const updated = await queryClient.fetchQuery<ProjectSummary[]>({ queryKey: ["/api/vendor-portal/projects"] });
      const refreshed = updated.find((p) => p.projectId === selectedProject.projectId);
      if (refreshed) setSelectedProject(refreshed);
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDownload = async (objectPath: string, fileName: string) => {
    try {
      const res = await fetch(`/api/files/download?path=${encodeURIComponent(objectPath)}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast({ title: "Download failed", variant: "destructive" });
    }
  };

  const initials = [user?.firstName, user?.lastName]
    .filter(Boolean)
    .map((s) => s![0])
    .join("")
    .toUpperCase() || user?.email?.[0]?.toUpperCase() || "V";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Top nav */}
      <header className="border-b bg-card sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Building2 className="h-5 w-5 text-muted-foreground" />
            <span className="font-semibold text-sm">Vendor Portal</span>
            {vendorInfo && (
              <>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{vendorInfo.name}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Avatar className="h-8 w-8">
              <AvatarFallback className="text-xs">{initials}</AvatarFallback>
            </Avatar>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => logout()}
              className="text-muted-foreground"
            >
              <LogOut className="h-4 w-4 mr-1.5" />
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-6 py-8 space-y-6">
        {/* Vendor info card */}
        {vendorLoading ? (
          <Card><CardContent className="p-6 text-sm text-muted-foreground">Loading…</CardContent></Card>
        ) : vendorInfo ? (
          <Card>
            <CardContent className="p-6 flex items-center gap-4">
              <div className="h-12 w-12 rounded-md bg-muted flex items-center justify-center">
                <Building2 className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="font-semibold text-lg">{vendorInfo.name}</p>
                {vendorInfo.category && (
                  <p className="text-sm text-muted-foreground">{vendorInfo.category}</p>
                )}
              </div>
            </CardContent>
          </Card>
        ) : null}

        {/* Projects section */}
        <div>
          <h2 className="text-base font-semibold mb-3">Your Projects</h2>
          {projectsLoading ? (
            <p className="text-sm text-muted-foreground">Loading projects…</p>
          ) : !projects || projects.length === 0 ? (
            <Card>
              <CardContent className="p-8 flex flex-col items-center gap-3 text-center">
                <FolderOpen className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  You haven't been added to any projects yet. Your project manager will add you when quotes are needed.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((p) => (
                <Card
                  key={p.projectId}
                  className="hover-elevate cursor-pointer"
                  onClick={() => setSelectedProject(p)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-semibold">{p.projectName}</CardTitle>
                    {p.clientName && (
                      <p className="text-xs text-muted-foreground">{p.clientName}</p>
                    )}
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm text-muted-foreground">
                        {p.quoteFiles.length} file{p.quoteFiles.length !== 1 ? "s" : ""} submitted
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Project detail drawer / dialog */}
      <Dialog open={!!selectedProject} onOpenChange={(o) => { if (!o) setSelectedProject(null); }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedProject?.projectName}</DialogTitle>
            {selectedProject?.clientName && (
              <DialogDescription>{selectedProject.clientName}</DialogDescription>
            )}
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium">Submitted Quote Files</h3>
              <Button
                size="sm"
                onClick={() => setUploadDialogOpen(true)}
              >
                <Upload className="h-4 w-4 mr-1.5" />
                Upload file
              </Button>
            </div>

            {selectedProject?.quoteFiles.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-8 text-center">
                <FileText className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">No files submitted yet. Upload your quote document above.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {selectedProject?.quoteFiles.map((f) => (
                  <div
                    key={f.id}
                    className="flex items-center justify-between gap-3 p-3 rounded-md border"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <CheckCircle2 className="h-4 w-4 text-green-600 dark:text-green-400 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{f.fileName}</p>
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(f.uploadedAt).toLocaleDateString()}
                          {f.uploadedByName && ` · ${f.uploadedByName}`}
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDownload(f.objectPath, f.fileName)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upload dialog */}
      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Quote File</DialogTitle>
            <DialogDescription>
              Upload your quote document for {selectedProject?.projectName}. Accepted formats: PDF, Excel, Word, CSV.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed rounded-md cursor-pointer hover:border-primary/50 transition-colors">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">Click to select a file</span>
              <input
                type="file"
                className="sr-only"
                accept=".pdf,.xlsx,.xls,.csv,.doc,.docx"
                onChange={handleFileUpload}
                disabled={uploading}
              />
            </label>
            {uploading && (
              <p className="text-sm text-center text-muted-foreground">Uploading…</p>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
