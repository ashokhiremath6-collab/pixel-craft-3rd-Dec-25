import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  image: string | null;
  role: 'admin' | 'designer' | 'client';
  isActive: boolean;
}

interface ReplitAuthData {
  id: string;
  email: string;
  name: string;
  username: string;
  imageUrl: string;
}

export function useAuth() {
  const { toast } = useToast();

  // Check current authentication status
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['/api/auth/me'],
    queryFn: async () => {
      const response = await fetch('/api/auth/me', {
        credentials: 'include'
      });
      
      // Handle 401 gracefully - return null for unauthenticated state
      if (response.status === 401) {
        return null;
      }
      
      if (!response.ok) {
        throw new Error(`Authentication check failed: ${response.status}`);
      }
      
      return response.json();
    },
    retry: false,
    refetchOnWindowFocus: false,
  });

  // Login with Replit Auth
  const loginMutation = useMutation({
    mutationFn: async (authData: ReplitAuthData) => {
      const response = await apiRequest('POST', '/api/auth/replit-login', authData);
      return response.json();
    },
    onSuccess: () => {
      // Invalidate auth query to refetch user data
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      toast({
        title: "Login successful",
        description: "Welcome to the vendor management system!",
      });
    },
    onError: (error: Error) => {
      console.error('Login error:', error);
      toast({
        title: "Login failed",
        description: error.message || "Failed to login with Replit Auth",
        variant: "destructive",
      });
    },
  });

  // Logout
  const logoutMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/auth/logout');
      return response;
    },
    onSuccess: () => {
      // Clear auth cache
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      // Reload page to redirect to login
      window.location.reload();
      toast({
        title: "Logged out successfully",
        description: "You have been logged out of your account.",
      });
    },
    onError: (error: Error) => {
      console.error('Logout error:', error);
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    },
  });

  return {
    user,
    isLoading,
    isAuthenticated: !!user && user.isActive,
    login: loginMutation.mutate,
    logout: logoutMutation.mutate,
    isLoginPending: loginMutation.isPending,
    isLogoutPending: logoutMutation.isPending,
  };
}