import type { ReactNode } from "react";
import { useRequireAuth } from "@/hooks/use-require-auth";

/**
 * Wrap a protected route's component tree. While auth is resolving OR
 * the user is unauthenticated (before redirect fires), renders a neutral
 * background instead of the protected UI — no flash, no broken shell.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { checking } = useRequireAuth();
  if (checking) {
    return <div className="min-h-screen bg-background" aria-hidden />;
  }
  return <>{children}</>;
}
