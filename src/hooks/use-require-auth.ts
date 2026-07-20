import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/context/AuthContext";

/**
 * Client-side auth gate for protected routes.
 * Redirects unauthenticated visitors to the login page ("/") once auth
 * state has resolved. Returns `true` while the caller should render a
 * neutral loading state instead of protected content.
 */
export function useRequireAuth(): { checking: boolean } {
  const { session, isAuthReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthReady && !session) {
      navigate({ to: "/", replace: true });
    }
  }, [isAuthReady, session, navigate]);

  return { checking: !isAuthReady || !session };
}
