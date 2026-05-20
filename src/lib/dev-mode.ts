import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";

const STORAGE_KEY = "bg_dev_mode";

function readDevMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function useDevMode(): {
  enabled: boolean;
  setEnabled: (v: boolean) => void;
} {
  const [enabled, setEnabledState] = useState<boolean>(() => readDevMode());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setEnabledState(readDevMode());
    };
    const onCustom = () => setEnabledState(readDevMode());
    window.addEventListener("storage", onStorage);
    window.addEventListener("bg-dev-mode-changed", onCustom);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bg-dev-mode-changed", onCustom);
    };
  }, []);

  const setEnabled = useCallback((v: boolean) => {
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "1" : "0");
    } catch {
      /* ignore */
    }
    setEnabledState(v);
    window.dispatchEvent(new Event("bg-dev-mode-changed"));
  }, []);

  return { enabled, setEnabled };
}

export function getDevModeFromStorage(): boolean {
  return readDevMode();
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
