import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface User {
  id: string;
  email: string | null;
  name: string | null;
  username: string | null;
  image: string | null;
  role: 'admin' | 'designer' | 'project_manager' | 'client';
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

  // Check current authentication status using real Replit Auth
  const { data: user, isLoading, error } = useQuery<User>({
    queryKey: ['/api/auth/user'],
    queryFn: async () => {
      const response = await fetch('/api/auth/user', {
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

  // Login function for Replit Auth - redirect to /api/login
  const login = () => {
    window.location.href = '/api/login';
  };

  // Logout function for Replit Auth - redirect to /api/logout
  const logout = () => {
    window.location.href = '/api/logout';
  };

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}