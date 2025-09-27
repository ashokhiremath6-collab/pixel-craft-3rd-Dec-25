import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

const loginSchema = z.object({
  email: z.string().email("Please enter a valid email"),
  password: z.string().min(6, "Password must be at least 6 characters"),
});

type LoginData = z.infer<typeof loginSchema>;

interface LoginPageProps {
  onLoginSuccess: () => void;
}

export default function LoginPage({ onLoginSuccess }: LoginPageProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<LoginData>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (data: LoginData) => {
    setIsLoading(true);
    try {
      const response = await apiRequest('POST', '/api/auth/login', data);

      if (response.ok) {
        toast({
          title: "Login successful",
          description: "Welcome back! Redirecting to your dashboard...",
        });
        onLoginSuccess();
      } else {
        const error = await response.json();
        toast({
          title: "Login failed",
          description: error.error || "Invalid credentials",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Login failed", 
        description: "Network error. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickLogin = async () => {
    setIsLoading(true);
    try {
      // Only attempt login with existing designer account
      const loginResponse = await apiRequest('POST', '/api/auth/login', {
        email: 'admin@company.com',
        password: 'password',
      });

      if (loginResponse.ok) {
        toast({
          title: "Quick login successful",
          description: "Logged in as designer. Welcome back to your data!",
        });
        onLoginSuccess();
      } else {
        const error = await loginResponse.json();
        toast({
          title: "Quick login failed",
          description: error.error || "Designer account not found. Please contact administrator.",
          variant: "destructive",
        });
      }
    } catch (error) {
      toast({
        title: "Quick login failed",
        description: "Please try manual login below",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome Back</CardTitle>
          <CardDescription>
            Your data is safe! Please log in to access your vendor management system.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Button 
              onClick={handleQuickLogin}
              disabled={isLoading}
              className="w-full"
              data-testid="button-quick-login"
            >
              {isLoading ? "Logging in..." : "Quick Login (admin@company.com)"}
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              Click above to quickly access your data, or login manually below
            </p>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">
                Or login manually
              </span>
            </div>
          </div>

          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                {...form.register("email")}
                data-testid="input-email"
              />
              {form.formState.errors.email && (
                <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                {...form.register("password")}
                data-testid="input-password"
              />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>

            <Button 
              type="submit" 
              disabled={isLoading}
              className="w-full"
              data-testid="button-login"
            >
              {isLoading ? "Logging in..." : "Login"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}