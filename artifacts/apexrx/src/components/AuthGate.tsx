import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";
import type { Role } from "@/lib/api";

export function AuthGate({ roles }: { roles?: Role[] }) {
  const { loggedIn, loading, user } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!loggedIn) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (user?.mustChangePassword && location.pathname !== "/account/security") {
    return <Navigate to="/account/security?force=1" replace />;
  }
  if (roles && user && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
