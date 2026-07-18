import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Send, MessageSquare } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import type { Project } from "@shared/schema";

interface EnrichedMessage {
  id: string;
  projectId: string;
  authorId: string;
  authorName: string;
  authorRole: string;
  content: string;
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  designer: "Designer",
  project_manager: "Project Manager",
  client: "Client",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-primary text-primary-foreground",
  designer: "bg-blue-500 text-white",
  project_manager: "bg-amber-500 text-white",
  client: "bg-emerald-500 text-white",
};

function getInitials(name: string) {
  return name
    .split(" ")
    .map(n => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export default function ProjectChatPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [draft, setDraft] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const role = (user as any)?.role as string;
  const orgId = (user as any)?.orgId as string;

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: messages = [], isLoading } = useQuery<EnrichedMessage[]>({
    queryKey: ["/api/projects", selectedProjectId, "messages"],
    queryFn: () => fetch(`/api/projects/${selectedProjectId}/messages`).then(r => r.json()),
    enabled: !!selectedProjectId,
    refetchInterval: 30_000,
  });

  const sendMutation = useMutation({
    mutationFn: (content: string) =>
      apiRequest("POST", `/api/projects/${selectedProjectId}/messages`, { content }),
    onSuccess: () => {
      setDraft("");
      queryClient.invalidateQueries({ queryKey: ["/api/projects", selectedProjectId, "messages"] });
      setTimeout(() => textareaRef.current?.focus(), 50);
    },
    onError: () => {
      toast({ variant: "destructive", title: "Failed to send message" });
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (projects.length > 0 && !selectedProjectId) {
      setSelectedProjectId((projects[0] as any).id);
    }
  }, [projects, selectedProjectId]);

  function handleSend() {
    const content = draft.trim();
    if (!content || sendMutation.isPending) return;
    sendMutation.mutate(content);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const selectedProject = projects.find((p: any) => p.id === selectedProjectId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b shrink-0">
        <MessageSquare className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-semibold leading-none">Project Chat</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Remarks and comments shared with your team and client
          </p>
        </div>
        <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
          <SelectTrigger className="w-56">
            <SelectValue placeholder="Select project…" />
          </SelectTrigger>
          <SelectContent>
            {(projects as any[]).map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.projectName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {!selectedProjectId ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">Select a project to view its chat thread.</p>
          </div>
        ) : isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-sm text-muted-foreground">Loading messages…</div>
          </div>
        ) : messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground gap-2">
            <MessageSquare className="h-10 w-10 opacity-30" />
            <p className="text-sm">No messages yet. Be the first to add a remark.</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.authorId === (user as any)?.id;
            return (
              <div key={msg.id} className={`flex gap-3 ${isMe ? "flex-row-reverse" : ""}`}>
                <Avatar className="h-8 w-8 shrink-0 mt-0.5">
                  <AvatarFallback className="text-xs bg-muted">
                    {getInitials(msg.authorName)}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex flex-col gap-1 max-w-[70%] ${isMe ? "items-end" : "items-start"}`}>
                  <div className={`flex items-center gap-2 ${isMe ? "flex-row-reverse" : ""}`}>
                    <span className="text-sm font-medium">{isMe ? "You" : msg.authorName}</span>
                    <Badge
                      variant="secondary"
                      className={`text-[10px] px-1.5 py-0 ${ROLE_COLORS[msg.authorRole] ?? "bg-muted text-muted-foreground"}`}
                    >
                      {ROLE_LABELS[msg.authorRole] ?? msg.authorRole}
                    </Badge>
                    <span className="text-[11px] text-muted-foreground">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <div
                    className={`rounded-md px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      isMe
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-foreground"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {selectedProjectId && (
        <div className="px-6 py-4 border-t shrink-0">
          <div className="flex gap-2 items-end">
            <Textarea
              ref={textareaRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type a remark… (Enter to send, Shift+Enter for new line)"
              className="resize-none min-h-[40px] max-h-32"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!draft.trim() || sendMutation.isPending}
              size="icon"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
