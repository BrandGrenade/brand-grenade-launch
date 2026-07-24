import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";

export const Route = createFileRoute("/login")({
  component: Login,
  head: () => ({
    meta: [
      { title: "Sign In — Brand Grenade" },
      { name: "description", content: "Sign in to the Brand Grenade Strategy Intelligence System." },
      { property: "og:title", content: "Sign In — Brand Grenade" },
      { property: "og:description", content: "Sign in to the Brand Grenade Strategy Intelligence System." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function Login() {
  const navigate = useNavigate();
  const { user, isAuthReady } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isAuthReady && user) navigate({ to: "/dashboard" });
  }, [isAuthReady, user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setError("");
    setSubmitting(true);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError("Incorrect email or password");
      return;
    }
    navigate({ to: "/dashboard" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-6 py-16">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-10 flex items-center gap-3">
          <BrandGrenadeIcon size={28} />
          <span className="text-h3 text-text-primary" style={{ fontSize: 20, letterSpacing: "-0.01em" }}>
            BRAND GRENADE
          </span>
        </Link>

        <span className="text-label text-primary">Access</span>
        <h1 id="auth-heading" className="text-h2 mt-3 mb-8 text-text-primary">
          Sign in to continue
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col">
          <label htmlFor="email" className="text-body-sm mb-2 text-text-secondary">
            Email address
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input-base h-11"
            placeholder="you@studio.com"
          />

          <label htmlFor="password" className="text-body-sm mb-2 mt-4 text-text-secondary">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input-base h-11"
            placeholder="••••••••"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex h-12 items-center justify-center rounded-md bg-primary px-5 text-[14px] font-semibold text-primary-foreground transition-colors hover:bg-primary-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign In"}
          </button>

          {error && (
            <p role="alert" className="text-body-sm mt-3" style={{ color: "var(--color-destructive, #C0392B)" }}>
              {error}
            </p>
          )}
        </form>

        <div className="mt-8">
          <Link to="/" className="text-body-sm text-text-tertiary hover:text-text-secondary">
            ← Back to homepage
          </Link>
        </div>
      </div>
    </main>
  );
}
