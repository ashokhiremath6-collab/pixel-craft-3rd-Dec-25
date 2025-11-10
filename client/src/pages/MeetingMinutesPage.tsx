import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download, Calendar } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import type { MeetingMinutes, Project } from "@shared/schema";
import { format } from "date-fns";

const MEETING_TYPES = [
  "Client Meeting",
  "Internal Meeting",
  "Site Visit",
  "Vendor Meeting",
  "Design Review",
  "Progress Meeting",
  "Other",
];

const LOCATIONS = [
  "Office",
  "Site",
  "Online/Video Call",
  "Client Office",
  "Vendor Office",
  "Other",
];

export default function MeetingMinutesPage() {
  const { toast } = useToast();
  const [projectFilter, setProjectFilter] = useState<string>("all");
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [meetingDateFilter, setMeetingDateFilter] = useState<string>("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMOM, setEditingMOM] = useState<MeetingMinutes | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [formData, setFormData] = useState({
    projectId: "general",
    meetingDate: "",
    meetingTitle: "",
    meetingType: "",
    attendees: "",
    location: "none",
    summary: "",
  });

  // Fetch meeting minutes
  const { data: minutes = [], isLoading } = useQuery<MeetingMinutes[]>({
    queryKey: ["/api/meeting-minutes"],
    queryFn: async () => {
      const response = await fetch("/api/meeting-minutes", { credentials: "include" });
      if (!response.ok) {
        throw new Error("Failed to fetch meeting minutes");
      }
      return response.json();
    },
  });

  // Fetch projects for dropdown
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ['/api/projects'],
  });

  // Filter and search
  const filteredMinutes = useMemo(() => {
    return minutes.filter((mom) => {
      // Meeting date filter
      if (meetingDateFilter && mom.meetingDate !== meetingDateFilter) return false;
      
      // Project filter
      if (projectFilter !== "all") {
        if (projectFilter === "general" && mom.projectId !== null) return false;
        if (projectFilter !== "general" && mom.projectId !== projectFilter) return false;
      }
      
      // Meeting type filter
      if (meetingTypeFilter !== "all" && mom.meetingType !== meetingTypeFilter) {
        return false;
      }
      
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          mom.meetingTitle.toLowerCase().includes(query) ||
          (mom.attendees && mom.attendees.toLowerCase().includes(query)) ||
          (mom.location && mom.location.toLowerCase().includes(query)) ||
          (mom.summary && mom.summary.toLowerCase().includes(query))
        );
      }
      
      return true;
    });
  }, [minutes, projectFilter, meetingTypeFilter, searchQuery, meetingDateFilter]);

  // Group by month
  const groupedMinutes = useMemo(() => {
    const groups = new Map<string, MeetingMinutes[]>();
    filteredMinutes.forEach((mom) => {
      const monthKey = mom.meetingDate.substring(0, 7); // YYYY-MM
      if (!groups.has(monthKey)) {
        groups.set(monthKey, []);
      }
      groups.get(monthKey)!.push(mom);
    });
    // Sort groups by month descending
    return new Map(
      Array.from(groups.entries())
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([key, value]) => [key, value.sort((a, b) => b.meetingDate.localeCompare(a.meetingDate))])
    );
  }, [filteredMinutes]);

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof formData) => {
      const formDataToSend = new FormData();
      if (data.projectId && data.projectId !== "general") formDataToSend.append("projectId", data.projectId);
      formDataToSend.append("meetingDate", data.meetingDate);
      formDataToSend.append("meetingTitle", data.meetingTitle);
      formDataToSend.append("meetingType", data.meetingType);
      formDataToSend.append("attendees", data.attendees);
      if (data.location && data.location !== "none") formDataToSend.append("location", data.location);
      if (data.summary) formDataToSend.append("summary", data.summary);
      
      if (selectedFile) {
        formDataToSend.append("file", selectedFile);
      } else if (!editingMOM) {
        throw new Error("File is required for new meeting minutes");
      }

      const url = editingMOM ? `/api/meeting-minutes/${editingMOM.id}` : "/api/meeting-minutes";
      const method = editingMOM ? "PUT" : "POST";

      const response = await fetch(url, {
        method,
        body: formDataToSend,
        credentials: "include",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save meeting minutes");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-minutes"] });
      setDialogOpen(false);
      setEditingMOM(null);
      setSelectedFile(null);
      setFormData({
        projectId: "",
        meetingDate: "",
        meetingTitle: "",
        meetingType: "",
        attendees: "",
        location: "",
        summary: "",
      });
      toast({
        title: "Success",
        description: editingMOM ? "Meeting minutes updated successfully" : "Meeting minutes uploaded successfully",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to save meeting minutes",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/meeting-minutes/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to delete meeting minutes");
      }
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-minutes"] });
      toast({
        title: "Success",
        description: "Meeting minutes deleted successfully",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to delete meeting minutes",
      });
    },
  });

  const handleDelete = (id: string) => {
    if (confirm("Are you sure you want to delete these meeting minutes?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleOpenDialog = (mom?: MeetingMinutes) => {
    setSelectedFile(null);
    if (mom) {
      setEditingMOM(mom);
      setFormData({
        projectId: mom.projectId || "general",
        meetingDate: mom.meetingDate,
        meetingTitle: mom.meetingTitle,
        meetingType: mom.meetingType,
        attendees: mom.attendees || "",
        location: mom.location || "none",
        summary: mom.summary || "",
      });
    } else {
      setEditingMOM(null);
      setFormData({
        projectId: projectFilter !== "all" && projectFilter !== "general" ? projectFilter : "general",
        meetingDate: new Date().toISOString().split('T')[0],
        meetingTitle: "",
        meetingType: meetingTypeFilter !== "all" ? meetingTypeFilter : "",
        attendees: "",
        location: "none",
        summary: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingMOM(null);
    setSelectedFile(null);
    setFormData({
      projectId: "general",
      meetingDate: "",
      meetingTitle: "",
      meetingType: "",
      attendees: "",
      location: "none",
      summary: "",
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.meetingDate || !formData.meetingTitle || !formData.meetingType) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Meeting date, title, and type are required",
      });
      return;
    }
    saveMutation.mutate(formData);
  };

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr + 'T00:00:00');
    return format(date, 'MMM d, yyyy');
  };

  const formatMonthYear = (monthKey: string): string => {
    const [year, month] = monthKey.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return format(date, 'MMMM yyyy');
  };

  const getProjectName = (projectId: string | null): string => {
    if (!projectId) return "General Meeting";
    const project = projects.find(p => p.id === projectId);
    return project?.projectName || "Unknown Project";
  };

  return (
    <div className="min-w-0 overflow-hidden p-4 sm:p-6 space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <h1 className="text-2xl font-bold truncate">Meeting Minutes</h1>
        <Button
          onClick={() => handleOpenDialog()}
          className="whitespace-nowrap"
          data-testid="button-add-mom"
        >
          <Plus className="h-4 w-4 mr-2" />
          Upload Meeting Minutes
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <Label htmlFor="meetingDate">Meeting Date</Label>
              <Input
                id="meetingDate"
                type="date"
                value={meetingDateFilter}
                onChange={(e) => setMeetingDateFilter(e.target.value)}
                data-testid="input-meeting-date"
              />
            </div>
            <div>
              <Label>Project</Label>
              <Select value={projectFilter} onValueChange={setProjectFilter}>
                <SelectTrigger data-testid="select-project-filter">
                  <SelectValue placeholder="All Projects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Projects</SelectItem>
                  <SelectItem value="general">General/Company Meetings</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.projectName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Meeting Type</Label>
              <Select value={meetingTypeFilter} onValueChange={setMeetingTypeFilter}>
                <SelectTrigger data-testid="select-type-filter">
                  <SelectValue placeholder="All Types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  {MEETING_TYPES.map((type) => (
                    <SelectItem key={type} value={type}>
                      {type}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Search</Label>
              <Input
                placeholder="Search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                data-testid="input-search"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Meeting Minutes List */}
      <Card>
        <CardContent className="pt-6">
          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading meeting minutes...</div>
          ) : groupedMinutes.size === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-20" />
              <p>No meeting minutes found</p>
              <p className="text-sm mt-1">Upload minutes to see them here</p>
            </div>
          ) : (
            <div className="space-y-6">
              {Array.from(groupedMinutes.entries()).map(([monthKey, monthMins]) => (
                <div key={monthKey}>
                  <h3 className="text-lg font-semibold mb-3 text-primary">{formatMonthYear(monthKey)}</h3>
                  <div className="space-y-2">
                    {monthMins.map((mom) => (
                      <Card key={mom.id} className="hover-elevate" data-testid={`mom-${mom.id}`}>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-base">{mom.meetingTitle}</h4>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                                  {mom.meetingType}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                <p><strong>Date:</strong> {formatDate(mom.meetingDate)}</p>
                                <p><strong>Project:</strong> {getProjectName(mom.projectId)}</p>
                                <p><strong>Attendees:</strong> {mom.attendees}</p>
                                {mom.location && <p><strong>Location:</strong> {mom.location}</p>}
                                {mom.summary && (
                                  <p className="mt-2 text-foreground"><strong>Summary:</strong> {mom.summary}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="ghost"
                                size="sm"
                                asChild
                                data-testid={`button-view-${mom.id}`}
                              >
                                <a href={mom.filePath} target="_blank" rel="noopener noreferrer">
                                  <Download className="h-4 w-4 mr-1" />
                                  View
                                </a>
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" data-testid={`button-menu-${mom.id}`}>
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleOpenDialog(mom)}>
                                    <Pencil className="h-4 w-4 mr-2" />
                                    Edit
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={() => handleDelete(mom.id)}
                                    className="text-destructive"
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingMOM ? "Edit Meeting Minutes" : "Upload Meeting Minutes"}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="projectId">Project (Optional)</Label>
                <Select
                  value={formData.projectId}
                  onValueChange={(value) => setFormData({ ...formData, projectId: value })}
                >
                  <SelectTrigger id="projectId" data-testid="select-project">
                    <SelectValue placeholder="General/Company Meeting" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">General/Company Meeting</SelectItem>
                    {projects.map((project) => (
                      <SelectItem key={project.id} value={project.id}>
                        {project.projectName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="meetingDate">Meeting Date *</Label>
                <Input
                  id="meetingDate"
                  type="date"
                  value={formData.meetingDate}
                  onChange={(e) => setFormData({ ...formData, meetingDate: e.target.value })}
                  required
                  data-testid="input-date"
                />
              </div>
            </div>

            <div>
              <Label htmlFor="meetingTitle">Meeting Title *</Label>
              <Input
                id="meetingTitle"
                value={formData.meetingTitle}
                onChange={(e) => setFormData({ ...formData, meetingTitle: e.target.value })}
                placeholder="e.g., Project Kick-off Meeting"
                required
                data-testid="input-title"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="meetingType">Meeting Type *</Label>
                <Select
                  value={formData.meetingType}
                  onValueChange={(value) => setFormData({ ...formData, meetingType: value })}
                >
                  <SelectTrigger id="meetingType" data-testid="select-type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {MEETING_TYPES.map((type) => (
                      <SelectItem key={type} value={type}>
                        {type}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="location">Location</Label>
                <Select
                  value={formData.location}
                  onValueChange={(value) => setFormData({ ...formData, location: value })}
                >
                  <SelectTrigger id="location" data-testid="select-location">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {LOCATIONS.map((loc) => (
                      <SelectItem key={loc} value={loc}>
                        {loc}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label htmlFor="attendees">Attendees</Label>
              <Textarea
                id="attendees"
                value={formData.attendees}
                onChange={(e) => setFormData({ ...formData, attendees: e.target.value })}
                placeholder="Optional: Enter attendee names (one per line or comma-separated)"
                rows={3}
                data-testid="input-attendees"
              />
            </div>

            <div>
              <Label htmlFor="summary">Summary</Label>
              <Textarea
                id="summary"
                value={formData.summary}
                onChange={(e) => setFormData({ ...formData, summary: e.target.value })}
                placeholder="Optional: Brief summary of key points discussed"
                rows={4}
                data-testid="input-summary"
              />
            </div>

            <div>
              <Label htmlFor="file">
                Meeting Minutes Document {editingMOM ? "(Optional - keep existing if not uploaded)" : "*"}
              </Label>
              <Input
                id="file"
                type="file"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                data-testid="input-file"
              />
              {selectedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Selected: {selectedFile.name}
                </p>
              )}
              {editingMOM && !selectedFile && (
                <p className="text-sm text-muted-foreground mt-1">
                  Current file: {editingMOM.fileName}
                </p>
              )}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={saveMutation.isPending} data-testid="button-save">
                {saveMutation.isPending ? "Saving..." : editingMOM ? "Update" : "Upload"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
