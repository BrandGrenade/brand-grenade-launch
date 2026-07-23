import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useDevMode, useIsAdmin } from "@/lib/dev-mode";
import { useAuth } from "@/context/AuthContext";
import { BrandGrenadeIcon } from "@/components/BrandGrenadeIcon";
import { unlockRepositoryAdminFromPlatform } from "@/lib/repo-admin.functions";


export interface SessionContext {
  brand: string;
  currentStage: number; // 1..20
  totalStages?: number;
  isRunning?: boolean;
}

export function TopNav({ session }: { session?: SessionContext }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();
  const isAdmin = useIsAdmin();
  const unlockRepoAdmin = useServerFn(unlockRepositoryAdminFromPlatform);
  const { signOut } = useAuth();
  const { enabled: devModeOn, setEnabled: setDevMode } = useDevMode();

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <div style={{ height: "calc(56px + var(--dev-mode-banner-height, 0px))" }} />
      <nav
        className="fixed left-0 right-0 flex items-center justify-center px-5 sm:px-8"
        style={{
          top: "var(--dev-mode-banner-height, 0px)",
          height: 56,
          backgroundColor: "#0A0A0A",
          borderBottom: "1px solid #2A2A2A",
          zIndex: 250,
        }}
      >
        <div
          className="flex w-full items-center justify-between"
          style={{ maxWidth: 1280 }}
        >
        <Link
          to="/dashboard"
          className="font-bold"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            color: "#F0EDE8",
            letterSpacing: "0.12em",
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <BrandGrenadeIcon size={24} />
          <span>BRAND GRENADE</span>
        </Link>

        <div className="flex items-center gap-4">
          {isAdmin && (
            <button
              type="button"
              role="switch"
              aria-checked={devModeOn}
              onClick={() => setDevMode(!devModeOn)}
              title="Toggle Development Mode — abbreviated AI output"
              className="flex items-center gap-2 transition-colors"
              style={{
                padding: "4px 8px",
                borderRadius: 6,
                border: "1px solid #2A2A2A",
                backgroundColor: devModeOn ? "rgba(200,135,58,0.15)" : "transparent",
                color: devModeOn ? "#D4924A" : "#8A8680",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.10em",
                fontFamily:
                  'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
              }}
            >
              <span
                aria-hidden
                style={{
                  display: "inline-block",
                  width: 22,
                  height: 12,
                  borderRadius: 999,
                  backgroundColor: devModeOn ? "#D4924A" : "#2A2A2A",
                  position: "relative",
                  transition: "background-color 120ms ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: 1,
                    left: devModeOn ? 11 : 1,
                    width: 10,
                    height: 10,
                    borderRadius: 999,
                    backgroundColor: "#0A0A0A",
                    transition: "left 120ms ease",
                  }}
                />
              </span>
              DEV MODE
            </button>
          )}
          {session && (
            <div className="hidden items-center gap-3 md:flex">
              <span style={{ color: "#5A5652", fontSize: 13 }}>
                {session.brand}
              </span>
              <span
                style={{
                  color: "#8A8680",
                  fontSize: 12,
                  fontFamily:
                    'ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace',
                }}
              >
                Stage {session.currentStage} / {session.totalStages ?? 27}
              </span>
              {session.isRunning && (
                <span
                  aria-label="Strategy process running"
                  className="inline-block animate-pulse"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    backgroundColor: "#D4924A",
                    boxShadow: "0 0 8px rgba(200,135,58,0.6)",
                  }}
                />
              )}
            </div>
          )}

          <button
            type="button"
            onClick={async () => {
              await signOut();
              navigate({ to: "/" });
            }}
            className="hidden items-center justify-center transition-opacity hover:opacity-90 sm:inline-flex"
            style={{
              height: 32,
              padding: "0 12px",
              borderRadius: 8,
              border: "1px solid #D4924A",
              backgroundColor: "#D4924A",
              color: "#0A0A0A",
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            Sign Out
          </button>

          <div ref={rootRef} className="relative">

            <button
              type="button"
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((v) => !v)}
              className="flex items-center justify-center transition-colors"
              style={{
                width: 32,
                height: 32,
                borderRadius: 999,
                backgroundColor: "#1C1C1C",
                border: "1px solid #2A2A2A",
                color: "#8A8680",
                fontSize: 12,
              }}
            >
              BG
            </button>
            {open && (
              <div
                role="menu"
                className="absolute right-0 mt-2 overflow-hidden"
                style={{
                  minWidth: 180,
                  backgroundColor: "#1C1C1C",
                  border: "1px solid #2A2A2A",
                  borderRadius: 8,
                  boxShadow:
                    "0 16px 32px rgba(0,0,0,0.4), 0 4px 8px rgba(0,0,0,0.3)",
                }}
              >
                <MenuItem
                  label="Dashboard"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/dashboard" });
                  }}
                />
                <MenuItem
                  label="Settings"
                  onClick={() => {
                    setOpen(false);
                    navigate({ to: "/settings" });
                  }}
                />
                {isAdmin && (
                  <MenuItem
                    label="Repositories Admin"
                    onClick={async () => {
                      setOpen(false);
                      await unlockRepoAdmin({});
                      navigate({ to: "/admin/repositories" });
                    }}
                  />
                )}
                <MenuItem
                  label="Sign Out"
                  onClick={async () => {
                    setOpen(false);
                    await signOut();
                    navigate({ to: "/" });
                  }}
                />
              </div>
            )}
          </div>
        </div>
        </div>
      </nav>
    </>
  );
}

function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      className="block w-full px-4 py-2.5 text-left transition-colors"
      style={{ color: "#F0EDE8", fontSize: 14 }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "#2A2A2A";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
    >
      {label}
    </button>
  );
}
