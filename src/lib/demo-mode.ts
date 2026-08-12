import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

/**
 * DEMO MODE — a pure viewing state.
 *
 * This is deliberately NOT the old dev_mode pattern. Nothing here is ever
 * written to a session row, and nothing here influences generation, prompts,
 * token budgets, quality or stored data. It is a client-local presentation
 * flag that unlocks the read-only Walkthrough view for any already-completed
 * session, and can be toggled on and off at any time with zero side effects.
 */

const STORAGE_KEY = "bg_demo_mode";
const EVENT = "bg-demo-mode-changed";

function readDemoMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useDemoMode(): {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(false);

  // Read after mount only — avoids an SSR/hydration mismatch.
  useEffect(() => {
    setEnabledState(readDemoMode());
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabledState(readDemoMode());
    };
    const onCustom = () => setEnabledState(readDemoMode());
    window.addEventListener("storage", onStorage);
    window.addEventListener(EVENT, onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(EVENT, onCustom);
    };
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    setEnabledState(v);
    window.dispatchEvent(new Event(EVENT));
  }, []);

  return { enabled, setEnabled };
}

/** Returns true if the current authenticated user is an admin (users.is_admin). */
export function useIsAdmin(): boolean {
  const { user, isAuthReady } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!isAuthReady) return;
    if (!user?.email) {
      setIsAdmin(false);
      return;
    }
    let cancelled = false;
    supabase
      .from("users")
      .select("is_admin")
      .eq("email", user.email)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setIsAdmin(Boolean(data?.is_admin));
      });
    return () => {
      cancelled = true;
    };
  }, [user?.email, isAuthReady]);

  return isAdmin;
}
