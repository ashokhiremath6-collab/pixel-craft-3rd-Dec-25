import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { Settings, UserCog, Shield, Eye } from "lucide-react";
import type { User } from "@shared/schema";

type UserWithRole = User & {
  role: string | null;
  roleIsActive: boolean;
};

export default function SettingsPage() {
  const { toast } = useToast();
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [selectedRole, setSelectedRole] = useState<string>("");

  // Fetch all users with their roles
  const { data: users, isLoading } = useQuery<UserWithRole[]>({
    queryKey: ["/api/users"],
  });

  // Mutation to update user role
  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      return apiRequest("POST", "/api/auth/role", { userId, role });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({
        title: "Role updated",
        description: "User role has been successfully updated.",
      });
      setEditingUserId(null);
      setSelectedRole("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error updating role",
        description: error.message || "Failed to update user role",
        variant: "destructive",
      });
    },
  });

  const handleSaveRole = (userId: string) => {
    if (!selectedRole) {
      toast({
        title: "No role selected",
        description: "Please select a role before saving",
        variant: "destructive",
      });
      return;
    }
    updateRoleMutation.mutate({ userId, role: selectedRole });
  };

  const getRoleBadgeVariant = (role: string | null) => {
    if (!role) return "secondary";
    switch (role) {
      case "admin":
        return "default";
      case "designer":
        return "default";
      case "project_manager":
        return "default";
      case "client":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getRoleIcon = (role: string | null) => {
    if (!role) return <Eye className="h-3 w-3" />;
    switch (role) {
      case "admin":
        return <Shield className="h-3 w-3" />;
      case "designer":
        return <UserCog className="h-3 w-3" />;
      case "project_manager":
        return <UserCog className="h-3 w-3" />;
      case "client":
        return <Eye className="h-3 w-3" />;
      default:
        return <Eye className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
          <p className="text-muted-foreground">Manage users and system preferences</p>
        </div>
        <div className="text-center py-8 text-muted-foreground">Loading users...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold" data-testid="heading-settings">Settings</h1>
        <p className="text-muted-foreground">Manage users and system preferences</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            User Role Management
          </CardTitle>
          <CardDescription>
            Assign roles to control access levels. Admins have full access, designers can upload and manage content, clients have read-only access.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!users || users.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <UserCog className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No users found</p>
            </div>
          ) : (
            <div className="space-y-3">
              {users.map((user) => {
                const isEditing = editingUserId === user.id;
                
                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between gap-4 p-4 rounded-md border"
                    data-testid={`user-row-${user.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium truncate" data-testid={`text-user-name-${user.id}`}>
                          {user.firstName} {user.lastName}
                        </p>
                        {user.role && (
                          <Badge variant={getRoleBadgeVariant(user.role)} className="flex items-center gap-1">
                            {getRoleIcon(user.role)}
                            {user.role}
                          </Badge>
                        )}
                        {!user.role && (
                          <Badge variant="secondary" className="flex items-center gap-1">
                            <Eye className="h-3 w-3" />
                            No role
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground truncate" data-testid={`text-user-email-${user.id}`}>
                        {user.email}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        User ID: <code className="text-xs">{user.id}</code>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <Select value={selectedRole} onValueChange={setSelectedRole}>
                            <SelectTrigger className="w-32" data-testid={`select-role-${user.id}`}>
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="designer">Designer</SelectItem>
                              <SelectItem value="project_manager">Project Manager</SelectItem>
                              <SelectItem value="client">Client</SelectItem>
                            </SelectContent>
                          </Select>
                          <Button
                            size="sm"
                            onClick={() => handleSaveRole(user.id)}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-save-role-${user.id}`}
                          >
                            {updateRoleMutation.isPending ? "Saving..." : "Save"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setEditingUserId(null);
                              setSelectedRole("");
                            }}
                            disabled={updateRoleMutation.isPending}
                            data-testid={`button-cancel-role-${user.id}`}
                          >
                            Cancel
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setEditingUserId(user.id);
                            setSelectedRole(user.role || "client");
                          }}
                          data-testid={`button-edit-role-${user.id}`}
                        >
                          Change Role
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Role Permissions</CardTitle>
          <CardDescription>Understanding access levels in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="flex items-start gap-3">
              <Shield className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Admin</p>
                <p className="text-muted-foreground">Full system access including user management and all content operations</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <UserCog className="h-5 w-5 text-primary mt-0.5" />
              <div>
                <p className="font-medium">Designer</p>
                <p className="text-muted-foreground">Can upload and manage all project content, vendors, and documents</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Eye className="h-5 w-5 text-muted-foreground mt-0.5" />
              <div>
                <p className="font-medium">Client</p>
                <p className="text-muted-foreground">Read-only access to assigned projects; cannot upload or modify content</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
