import { ShieldOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

interface AccessDeniedProps {
  message?: string;
}

export function AccessDenied({ message = "You don't have permission to view this page." }: AccessDeniedProps) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-[60vh] gap-4 p-8 text-center">
      <ShieldOff className="h-12 w-12 text-muted-foreground" />
      <div className="flex flex-col gap-2">
        <h1 className="text-xl font-semibold">Access Denied</h1>
        <p className="text-muted-foreground max-w-sm">{message}</p>
      </div>
      <Button asChild variant="outline">
        <Link href="/">Go Home</Link>
      </Button>
    </div>
  );
}
