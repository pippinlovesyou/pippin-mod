import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import NotFound from "@/pages/not-found";
import Dashboard from "@/pages/dashboard";
import WarningLevels from "@/pages/warning-levels";
import Settings from "@/pages/settings";
import History from "@/pages/history";
import Users from "@/pages/users";
import { Navbar } from "@/components/ui/navbar";
import AuthPage from "@/pages/auth-page";
import { useUser } from "@/hooks/use-user";
import { Loader2 } from "lucide-react";

function Router() {
  const { user, isLoading } = useUser();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/rules" component={WarningLevels} />
        <Route path="/settings" component={Settings} />
        <Route path="/history" component={History} />
        <Route path="/users" component={Users} />
        <Route component={NotFound} />
      </Switch>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  );
}

export default App;