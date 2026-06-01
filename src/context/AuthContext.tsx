import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  isAuthReady: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  isAuthReady: false,
  signOut: async () => {},
});

const initialSessionPromise =
  typeof window !== "undefined"
    ? supabase.auth.getSession()
    : Promise.resolve({ data: { session: null }, error: null });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    initialSessionPromise
      .then(({ data }) => {
        if (!isMounted) return;
        setSession(data.session);
        setIsAuthReady(true);
      })
      .catch(() => {
        if (!isMounted) return;
        setSession(null);
        setIsAuthReady(true);
      });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, newSession) => {
      if (event === "TOKEN_REFRESHED") {
        console.log("Token refreshed successfully");
      }

      if (event === "SIGNED_OUT") {
        // redirect to login
      }

      setSession(newSession);
      setIsAuthReady(true);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const value: AuthContextType = {
    session,
    user: session?.user ?? null,
    isAuthReady,
    signOut: async () => {
      await supabase.auth.signOut();
    },
  };

  if (!isAuthReady) return null;

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
