import { useState, useMemo, useRef, useEffect } from "react";
import { sortProjectsForDropdown } from "@/lib/projectSort";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { DeleteConfirmDialog } from "@/components/DeleteConfirmDialog";
import { FileViewerModal } from "@/components/FileViewerModal";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Plus, MoreVertical, Pencil, Trash2, FileText, Download, Calendar, Sparkles, FileDown, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { Label } from "@/components/ui/label";
import type { MeetingMinutes, Project, MeetingActionItem } from "@shared/schema";
import { format } from "date-fns";

interface ParsedFireflies {
  attendees: string[];
  summary: string;
  actionItems: {
    serialNo: number;
    issueDiscussed: string;
    responsibility: string | null;
    deadline: string | null;
    remarks: string | null;
  }[];
}

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
  const [projectFilter, setProjectFilter] = useState<string>("");
  const [meetingTypeFilter, setMeetingTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [meetingDateFilter, setMeetingDateFilter] = useState<string>("");
  const [sourceFilter, setSourceFilter] = useState<"all" | "manual" | "fireflies">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMOM, setEditingMOM] = useState<MeetingMinutes | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{url: string, name: string} | null>(null);
  const [formData, setFormData] = useState({
    projectId: "general",
    meetingDate: "",
    meetingTitle: "",
    meetingType: "",
    attendees: "",
    location: "none",
    summary: "",
  });
  
  // Fireflies conversion state
  const [firefliesDialogOpen, setFirefliesDialogOpen] = useState(false);
  const [firefliesTranscript, setFirefliesTranscript] = useState("");
  const [firefliesProjectId, setFirefliesProjectId] = useState<string>("general");
  const [firefliesMeetingDate, setFirefliesMeetingDate] = useState(new Date().toISOString().split('T')[0]);
  const [firefliesMeetingTitle, setFirefliesMeetingTitle] = useState("");
  const [firefliesLocation, setFirefliesLocation] = useState<string>("Site");
  const [parsedData, setParsedData] = useState<ParsedFireflies | null>(null);
  const [expandedActionItems, setExpandedActionItems] = useState<Set<string>>(new Set());
  const [actionItemsCache, setActionItemsCache] = useState<Map<string, MeetingActionItem[]>>(new Map());

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
      // Source filter
      if (sourceFilter !== "all") {
        const momSource = (mom as any).source || "manual";
        if (sourceFilter !== momSource) return false;
      }
      
      // Meeting date filter
      if (meetingDateFilter && mom.meetingDate !== meetingDateFilter) return false;
      
      // Project filter
      if (projectFilter) {
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
  }, [minutes, projectFilter, meetingTypeFilter, searchQuery, meetingDateFilter, sourceFilter]);

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
        let errorMessage = "Failed to save meeting minutes";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch {
          errorMessage = `Upload failed (server error ${response.status}). Please try again.`;
        }
        throw new Error(errorMessage);
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
    setDeletingId(id);
  };

  const confirmDelete = () => {
    if (deletingId) {
      deleteMutation.mutate(deletingId);
      setDeletingId(null);
    }
  };

  // Parse Fireflies transcript mutation
  const parseFirefliesMutation = useMutation({
    mutationFn: async (data: { transcript: string; meetingDate: string; projectName: string }) => {
      const response = await fetch("/api/parse-fireflies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to parse transcript");
      }
      return response.json() as Promise<ParsedFireflies>;
    },
    onSuccess: (data) => {
      setParsedData(data);
      toast({
        title: "Success",
        description: `Extracted ${data.actionItems.length} action items from transcript`,
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "Failed to parse Fireflies transcript",
      });
    },
  });

  // Fetch action items for a meeting
  const fetchActionItems = async (meetingId: string) => {
    if (actionItemsCache.has(meetingId)) {
      return actionItemsCache.get(meetingId)!;
    }
    const response = await fetch(`/api/meeting-minutes/${meetingId}/action-items`, {
      credentials: "include",
    });
    if (response.ok) {
      const items = await response.json() as MeetingActionItem[];
      setActionItemsCache(prev => new Map(prev).set(meetingId, items));
      return items;
    }
    return [];
  };

  // Toggle action items visibility
  const toggleActionItems = async (meetingId: string) => {
    if (expandedActionItems.has(meetingId)) {
      setExpandedActionItems(prev => {
        const newSet = new Set(prev);
        newSet.delete(meetingId);
        return newSet;
      });
    } else {
      await fetchActionItems(meetingId);
      setExpandedActionItems(prev => new Set(prev).add(meetingId));
    }
  };

  // Save action items mutation
  const saveActionItemsMutation = useMutation({
    mutationFn: async ({ meetingId, actionItems }: { meetingId: string; actionItems: ParsedFireflies['actionItems'] }) => {
      const response = await fetch(`/api/meeting-minutes/${meetingId}/action-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ actionItems }),
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error("Failed to save action items");
      }
      return response.json() as Promise<MeetingActionItem[]>;
    },
    onSuccess: (savedItems, variables) => {
      // Update cache with saved items
      setActionItemsCache(prev => new Map(prev).set(variables.meetingId, savedItems));
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-minutes"] });
    },
  });

  // Create meeting with action items
  const createMeetingWithActionsMutation = useMutation({
    mutationFn: async (data: {
      projectId: string | null;
      meetingDate: string;
      meetingTitle: string;
      attendees: string;
      summary: string;
      location: string;
      actionItems: ParsedFireflies['actionItems'];
    }) => {
      // First create a placeholder file for the meeting (since file is required)
      const formDataToSend = new FormData();
      if (data.projectId && data.projectId !== "general") {
        formDataToSend.append("projectId", data.projectId);
      }
      formDataToSend.append("meetingDate", data.meetingDate);
      formDataToSend.append("meetingTitle", data.meetingTitle);
      formDataToSend.append("meetingType", "Progress Meeting");
      formDataToSend.append("attendees", data.attendees);
      formDataToSend.append("summary", data.summary);
      formDataToSend.append("location", data.location);
      formDataToSend.append("source", "fireflies");
      
      // Create a text file with the parsed content as the meeting document
      const content = generateMeetingMinutesText(data);
      const blob = new Blob([content], { type: 'text/plain' });
      const file = new File([blob], `MOM_${data.meetingDate}_${data.meetingTitle.replace(/[^a-zA-Z0-9]/g, '_')}.txt`, { type: 'text/plain' });
      formDataToSend.append("file", file);
      
      const response = await fetch("/api/meeting-minutes", {
        method: "POST",
        body: formDataToSend,
        credentials: "include",
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create meeting minutes");
      }
      
      const meeting = await response.json();
      
      // Now save the action items
      if (data.actionItems.length > 0) {
        await saveActionItemsMutation.mutateAsync({
          meetingId: meeting.id,
          actionItems: data.actionItems,
        });
      }
      
      return meeting;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/meeting-minutes"] });
      setFirefliesDialogOpen(false);
      setParsedData(null);
      setFirefliesTranscript("");
      setFirefliesMeetingTitle("");
      toast({
        title: "Success",
        description: "Meeting minutes created with action items",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message,
      });
    },
  });

  // Generate meeting minutes text content
  const generateMeetingMinutesText = (data: {
    meetingDate: string;
    meetingTitle: string;
    attendees: string;
    summary: string;
    actionItems: ParsedFireflies['actionItems'];
  }): string => {
    const projectName = firefliesProjectId !== "general" 
      ? projects.find(p => p.id === firefliesProjectId)?.projectName || "Unknown Project"
      : "General Meeting";
    
    let content = `MINUTES OF MEETING on ${format(new Date(data.meetingDate + 'T00:00:00'), 'dd-MM-yy')}\n`;
    content += `${'='.repeat(60)}\n\n`;
    content += `Project: ${projectName}\n`;
    content += `Date: ${format(new Date(data.meetingDate + 'T00:00:00'), 'dd MMMM yyyy')}\n\n`;
    content += `ATTENDEES\n${'-'.repeat(40)}\n`;
    content += `${data.attendees}\n\n`;
    content += `SUMMARY\n${'-'.repeat(40)}\n`;
    content += `${data.summary}\n\n`;
    content += `ACTION ITEMS\n${'-'.repeat(80)}\n\n`;
    
    data.actionItems.forEach((item) => {
      // Safe deadline formatting
      let deadlineStr = "-";
      if (item.deadline && item.deadline !== "-" && item.deadline !== "null" && /^\d{4}-\d{2}-\d{2}$/.test(item.deadline)) {
        try {
          deadlineStr = format(new Date(item.deadline + 'T00:00:00'), 'dd-MM-yyyy');
        } catch {
          deadlineStr = item.deadline;
        }
      }
      
      content += `${item.serialNo}. ${item.issueDiscussed}\n`;
      content += `   Responsibility: ${item.responsibility || '-'}\n`;
      content += `   Deadline: ${deadlineStr}\n`;
      if (item.remarks) {
        content += `   Remarks: ${item.remarks}\n`;
      }
      content += `\n`;
    });
    
    return content;
  };

  // Handle Fireflies parse
  const handleParseFireflies = () => {
    if (!firefliesTranscript.trim()) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please paste the Fireflies transcript",
      });
      return;
    }
    
    const projectName = firefliesProjectId !== "general"
      ? projects.find(p => p.id === firefliesProjectId)?.projectName || ""
      : "";
    
    parseFirefliesMutation.mutate({
      transcript: firefliesTranscript,
      meetingDate: firefliesMeetingDate,
      projectName,
    });
  };

  // Handle save parsed meeting
  const handleSaveParsedMeeting = () => {
    if (!parsedData || !firefliesMeetingTitle) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Please provide a meeting title",
      });
      return;
    }
    
    createMeetingWithActionsMutation.mutate({
      projectId: firefliesProjectId !== "general" ? firefliesProjectId : null,
      meetingDate: firefliesMeetingDate,
      meetingTitle: firefliesMeetingTitle,
      attendees: parsedData.attendees.join(", "),
      summary: parsedData.summary,
      location: firefliesLocation,
      actionItems: parsedData.actionItems,
    });
  };

  // Format deadline for display
  const formatDeadline = (deadline: string | null): string => {
    if (!deadline || deadline === "-" || deadline === "null") return "-";
    try {
      // Validate it's a proper date format before parsing
      if (!/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return deadline;
      return format(new Date(deadline + 'T00:00:00'), 'dd-MM-yyyy');
    } catch {
      return deadline;
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
        projectId: projectFilter && projectFilter !== "general" ? projectFilter : "general",
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
    <div className="min-w-0 overflow-hidden p-4 sm:p-6 space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h1 className="text-xl sm:text-2xl font-bold">Meeting Minutes</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setFirefliesDialogOpen(true);
              setParsedData(null);
              setFirefliesTranscript("");
              setFirefliesMeetingTitle("");
            }}
            className="whitespace-nowrap"
            data-testid="button-convert-fireflies"
          >
            <Sparkles className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Convert </span>Fireflies
          </Button>
          <Button
            onClick={() => handleOpenDialog()}
            size="sm"
            className="whitespace-nowrap"
            data-testid="button-add-mom"
          >
            <Plus className="h-4 w-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Upload </span>Minutes
          </Button>
        </div>
      </div>

      {/* Source Tabs */}
      <div className="flex gap-1 sm:gap-2 border-b pb-2 overflow-x-auto">
        <Button
          variant={sourceFilter === "all" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSourceFilter("all")}
          className="text-xs sm:text-sm whitespace-nowrap"
        >
          All
        </Button>
        <Button
          variant={sourceFilter === "manual" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSourceFilter("manual")}
          className="text-xs sm:text-sm whitespace-nowrap"
        >
          <FileText className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          PM
        </Button>
        <Button
          variant={sourceFilter === "fireflies" ? "default" : "ghost"}
          size="sm"
          onClick={() => setSourceFilter("fireflies")}
          className="text-xs sm:text-sm whitespace-nowrap"
        >
          <Sparkles className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
          Fireflies
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
                  <SelectItem value="general">General/Company Meetings</SelectItem>
                  {sortProjectsForDropdown(projects).map((project) => (
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
                          <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h4 className="font-semibold text-base break-words">{mom.meetingTitle}</h4>
                                <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded whitespace-nowrap">
                                  {mom.meetingType}
                                </span>
                              </div>
                              <div className="mt-2 space-y-1 text-sm text-muted-foreground">
                                <p><strong>Date:</strong> {formatDate(mom.meetingDate)}</p>
                                <p><strong>Project:</strong> {getProjectName(mom.projectId)}</p>
                                <p className="break-words"><strong>Attendees:</strong> {mom.attendees}</p>
                                {mom.location && <p><strong>Location:</strong> {mom.location}</p>}
                                {mom.uploadedAt && (
                                  <p data-testid={`text-upload-time-${mom.id}`}>
                                    <strong>Uploaded:</strong> {format(new Date(mom.uploadedAt), 'dd MMM yyyy, HH:mm')}
                                  </p>
                                )}
                                {mom.summary && (
                                  <p className="mt-2 text-foreground break-words"><strong>Summary:</strong> {mom.summary}</p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleActionItems(mom.id)}
                                data-testid={`button-action-items-${mom.id}`}
                              >
                                {expandedActionItems.has(mom.id) ? (
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                ) : (
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                )}
                                Action Items
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setViewingFile({ url: mom.filePath, name: mom.fileName })}
                                data-testid={`button-view-${mom.id}`}
                              >
                                <Download className="h-4 w-4 mr-1" />
                                View
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
                          
                          {/* Action Items Table */}
                          {expandedActionItems.has(mom.id) && (
                            <div className="mt-4 border rounded-md overflow-x-auto">
                              {actionItemsCache.get(mom.id)?.length === 0 ? (
                                <div className="p-4 text-center text-muted-foreground text-sm">
                                  No action items recorded for this meeting
                                </div>
                              ) : (
                                <Table>
                                  <TableHeader>
                                    <TableRow>
                                      <TableHead className="w-16">SR NO</TableHead>
                                      <TableHead>ISSUES DISCUSSED</TableHead>
                                      <TableHead className="w-32">RESPONSIBILITY</TableHead>
                                      <TableHead className="w-28">DEADLINE</TableHead>
                                      <TableHead className="w-40">REMARKS</TableHead>
                                    </TableRow>
                                  </TableHeader>
                                  <TableBody>
                                    {actionItemsCache.get(mom.id)?.map((item) => (
                                      <TableRow key={item.id}>
                                        <TableCell className="font-medium">{item.serialNo}</TableCell>
                                        <TableCell>{item.issueDiscussed}</TableCell>
                                        <TableCell>{item.responsibility || "-"}</TableCell>
                                        <TableCell>{formatDeadline(item.deadline)}</TableCell>
                                        <TableCell>{item.remarks || "-"}</TableCell>
                                      </TableRow>
                                    ))}
                                  </TableBody>
                                </Table>
                              )}
                            </div>
                          )}
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
        <DialogContent className="max-w-[95vw] sm:max-w-2xl max-h-[90vh] overflow-y-auto">
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
                    {sortProjectsForDropdown(projects).map((project) => (
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

      <DeleteConfirmDialog
        isOpen={!!deletingId}
        onClose={() => setDeletingId(null)}
        onConfirm={confirmDelete}
        isDeleting={deleteMutation.isPending}
      />

      <FileViewerModal
        isOpen={!!viewingFile}
        onClose={() => setViewingFile(null)}
        fileUrl={viewingFile?.url || ''}
        fileName={viewingFile?.name}
      />

      {/* Fireflies Conversion Dialog */}
      <Dialog open={firefliesDialogOpen} onOpenChange={setFirefliesDialogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5" />
              Convert Fireflies Transcript
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {!parsedData ? (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor="fireflies-project">Project</Label>
                    <Select
                      value={firefliesProjectId}
                      onValueChange={setFirefliesProjectId}
                    >
                      <SelectTrigger id="fireflies-project">
                        <SelectValue placeholder="Select project" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="general">General/Company Meeting</SelectItem>
                        {sortProjectsForDropdown(projects).map((project) => (
                          <SelectItem key={project.id} value={project.id}>
                            {project.projectName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor="fireflies-date">Meeting Date</Label>
                    <Input
                      id="fireflies-date"
                      type="date"
                      value={firefliesMeetingDate}
                      onChange={(e) => setFirefliesMeetingDate(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label htmlFor="fireflies-location">Location</Label>
                    <Select
                      value={firefliesLocation}
                      onValueChange={setFirefliesLocation}
                    >
                      <SelectTrigger id="fireflies-location">
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
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
                  <Label htmlFor="fireflies-transcript">
                    Paste Fireflies Transcript
                  </Label>
                  <Textarea
                    id="fireflies-transcript"
                    value={firefliesTranscript}
                    onChange={(e) => setFirefliesTranscript(e.target.value)}
                    placeholder="Paste your Fireflies.ai meeting transcript here..."
                    rows={12}
                    className="font-mono text-sm"
                  />
                </div>
                
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setFirefliesDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    onClick={handleParseFireflies}
                    disabled={parseFirefliesMutation.isPending || !firefliesTranscript.trim()}
                  >
                    {parseFirefliesMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Parsing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-4 w-4 mr-2" />
                        Parse Transcript
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            ) : (
              <>
                <div className="border rounded-md p-4 bg-muted/30">
                  <h3 className="font-semibold text-lg mb-4">Parsed Meeting Minutes</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label htmlFor="parsed-title">Meeting Title *</Label>
                      <Input
                        id="parsed-title"
                        value={firefliesMeetingTitle}
                        onChange={(e) => setFirefliesMeetingTitle(e.target.value)}
                        placeholder="Enter meeting title"
                      />
                    </div>
                    <div>
                      <Label>Date</Label>
                      <p className="text-sm text-muted-foreground mt-1">
                        {formatDate(firefliesMeetingDate)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
                    <Label>Attendees</Label>
                    <p className="text-sm mt-1">{parsedData.attendees.join(", ")}</p>
                  </div>
                  
                  <div className="mb-4">
                    <Label>Summary</Label>
                    <p className="text-sm mt-1">{parsedData.summary}</p>
                  </div>
                  
                  <div>
                    <Label className="mb-2 block">Action Items ({parsedData.actionItems.length})</Label>
                    <div className="border rounded-md overflow-x-auto bg-background">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-16">SR NO</TableHead>
                            <TableHead>ISSUES DISCUSSED</TableHead>
                            <TableHead className="w-32">RESPONSIBILITY</TableHead>
                            <TableHead className="w-28">DEADLINE</TableHead>
                            <TableHead className="w-40">REMARKS</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {parsedData.actionItems.map((item) => (
                            <TableRow key={item.serialNo}>
                              <TableCell className="font-medium">{item.serialNo}</TableCell>
                              <TableCell>{item.issueDiscussed}</TableCell>
                              <TableCell>{item.responsibility || "-"}</TableCell>
                              <TableCell>{formatDeadline(item.deadline)}</TableCell>
                              <TableCell>{item.remarks || "-"}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </div>
                
                <DialogFooter className="gap-2">
                  <Button
                    variant="outline"
                    onClick={() => setParsedData(null)}
                  >
                    Back to Edit
                  </Button>
                  <Button
                    onClick={handleSaveParsedMeeting}
                    disabled={createMeetingWithActionsMutation.isPending || !firefliesMeetingTitle.trim()}
                  >
                    {createMeetingWithActionsMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <FileDown className="h-4 w-4 mr-2" />
                        Save Meeting Minutes
                      </>
                    )}
                  </Button>
                </DialogFooter>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
