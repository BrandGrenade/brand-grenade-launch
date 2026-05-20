import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, type ReactNode } from "react";
import { TopNav } from "@/components/TopNav";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
  head: () => ({
    meta: [
      { title: "Settings — Brand Grenade" },
      { name: "description", content: "Account and pipeline preferences." },
    ],
  }),
});

type StrategicMode =
  | "Category Reframe"
  | "Audience Reframe"
  | "Constraint Reframe"
  | "Insight-Led";
const STRATEGIC_MODES: StrategicMode[] = [
  "Category Reframe",
  "Audience Reframe",
  "Constraint Reframe",
  "Insight-Led",
];

type Format = "Agency Pitch" | "Consulting Delivery" | "Brand Workshop";
const FORMATS: Format[] = ["Agency Pitch", "Consulting Delivery", "Brand Workshop"];

interface Prefs {
  defaultMode: StrategicMode;
  defaultFormat: Format;
  autoProceed: boolean;
  claudeKeyLast4: string;
  notifyComplete: boolean;
  notifyCheckpoint: boolean;
}

const DEFAULTS: Prefs = {
  defaultMode: "Category Reframe",
  defaultFormat: "Consulting Delivery",
  autoProceed: true,
  claudeKeyLast4: "",
  notifyComplete: false,
  notifyCheckpoint: false,
};

const STORAGE_KEY = "bg:settings:v1";

function loadPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Prefs>) };
  } catch {
    return DEFAULTS;
  }
}

function SettingsPage() {
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);
  const [hydrated, setHydrated] = useState(false);
  const [claudeKeyInput, setClaudeKeyInput] = useState("");
  const [savedFlash, setSavedFlash] = useState(false);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    setPrefs(loadPrefs());
    setHydrated(true);
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setSavedFlash(true);
    const id = window.setTimeout(() => setSavedFlash(false), 1200);
    return () => window.clearTimeout(id);
  }, [prefs, hydrated]);

  const update = <K extends keyof Prefs>(key: K, value: Prefs[K]) =>
    setPrefs((p) => ({ ...p, [key]: value }));

  const saveClaudeKey = () => {
    const key = claudeKeyInput.trim();
    if (!key) return;
    update("claudeKeyLast4", key.slice(-4));
    setClaudeKeyInput("");
  };

  const clearClaudeKey = () => {
    update("claudeKeyLast4", "");
    setClaudeKeyInput("");
  };

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        className="mx-auto px-5 sm:px-8"
        style={{ maxWidth: 640, paddingTop: 48, paddingBottom: 96 }}
      >
        <header className="mb-10">
          <span className="text-label text-primary">Account & Preferences</span>
          <div className="mt-3 flex items-end justify-between gap-4">
            <h1 className="text-h2 text-text-primary">Settings</h1>
            <span
              aria-live="polite"
              className="text-body-sm transition-opacity"
              style={{
                color: "var(--color-text-tertiary)",
                opacity: savedFlash ? 1 : 0,
              }}
            >
              Saved
            </span>
          </div>
        </header>

        <Section title="Account">
          <Row label="Email">
            <span className="text-body text-text-primary">demo@brandgrenade.com</span>
          </Row>
          <Row label="Password">
            <button
              type="button"
              className="text-body font-medium text-primary"
              onClick={() => alert("A password reset link would be emailed to you.")}
            >
              Send reset link
            </button>
          </Row>
          <Row label="Plan">
            <PlanBadge plan="Demo" />
          </Row>
        </Section>

        <Section title="Pipeline Preferences">
          <Row label="Default strategic mode">
            <Select
              value={prefs.defaultMode}
              onChange={(v) => update("defaultMode", v as StrategicMode)}
              options={STRATEGIC_MODES}
            />
          </Row>
          <Row label="Default output format">
            <Select
              value={prefs.defaultFormat}
              onChange={(v) => update("defaultFormat", v as Format)}
              options={FORMATS}
            />
          </Row>
          <Row
            label="Auto-proceed between stages"
            help="When off, each automated stage pauses with a Continue button."
          >
            <Toggle
              checked={prefs.autoProceed}
              onChange={(v) => update("autoProceed", v)}
            />
          </Row>
        </Section>

        <Section
          title="API Configuration"
          subtitle="Enterprise only — use your own Claude API key instead of the platform key."
        >
          {prefs.claudeKeyLast4 ? (
            <Row label="Claude API key">
              <div className="flex items-center gap-3">
                <span
                  className="text-mono"
                  style={{ color: "var(--color-text-secondary)" }}
                >
                  •••• •••• •••• {prefs.claudeKeyLast4}
                </span>
                <button
                  type="button"
                  onClick={clearClaudeKey}
                  className="text-body-sm font-medium"
                  style={{ color: "var(--color-destructive)" }}
                >
                  Remove
                </button>
              </div>
            </Row>
          ) : (
            <Row label="Claude API key">
              <div className="flex w-full items-center gap-2">
                <input
                  type="password"
                  value={claudeKeyInput}
                  onChange={(e) => setClaudeKeyInput(e.target.value)}
                  placeholder="sk-ant-…"
                  className="input-base flex-1"
                  autoComplete="off"
                  spellCheck={false}
                />
                <button
                  type="button"
                  onClick={saveClaudeKey}
                  disabled={!claudeKeyInput.trim()}
                  className="inline-flex h-9 items-center justify-center rounded-md px-4 text-[13px] font-semibold"
                  style={{
                    backgroundColor: "var(--color-primary)",
                    color: "var(--color-primary-foreground)",
                    opacity: claudeKeyInput.trim() ? 1 : 0.5,
                  }}
                >
                  Save
                </button>
              </div>
            </Row>
          )}
        </Section>

        <Section title="Notifications">
          <Row label="Email me when a pipeline completes">
            <Toggle
              checked={prefs.notifyComplete}
              onChange={(v) => update("notifyComplete", v)}
            />
          </Row>
          <Row label="Email me when a checkpoint review is needed">
            <Toggle
              checked={prefs.notifyCheckpoint}
              onChange={(v) => update("notifyCheckpoint", v)}
            />
          </Row>
        </Section>
      </main>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <section
      className="mb-8 overflow-hidden"
      style={{
        backgroundColor: "var(--color-card)",
        border: "1px solid var(--color-border)",
        borderRadius: 12,
      }}
    >
      <header
        className="px-6 py-4"
        style={{ borderBottom: "1px solid var(--color-border)" }}
      >
        <h2
          className="text-text-primary"
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: "-0.005em" }}
        >
          {title}
        </h2>
        {subtitle && (
          <p
            className="text-body-sm mt-1"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {subtitle}
          </p>
        )}
      </header>
      <div>{children}</div>
    </section>
  );
}

function Row({
  label,
  help,
  children,
}: {
  label: string;
  help?: string;
  children: ReactNode;
}) {
  return (
    <div
      className="flex items-start justify-between gap-6 px-6 py-4"
      style={{ borderTop: "1px solid var(--color-surface-3)" }}
    >
      <div className="min-w-0 flex-1">
        <div className="text-body text-text-primary">{label}</div>
        {help && (
          <p
            className="text-body-sm mt-1"
            style={{ color: "var(--color-text-tertiary)" }}
          >
            {help}
          </p>
        )}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  options: readonly string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-base"
      style={{ minWidth: 220 }}
    >
      {options.map((o) => (
        <option key={o} value={o}>
          {o}
        </option>
      ))}
    </select>
  );
}

function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="relative inline-flex items-center transition-colors"
      style={{
        width: 36,
        height: 20,
        borderRadius: 999,
        backgroundColor: checked ? "var(--color-primary)" : "var(--color-surface-3)",
        border: "1px solid var(--color-border)",
      }}
    >
      <span
        className="block transition-transform"
        style={{
          width: 14,
          height: 14,
          borderRadius: 999,
          backgroundColor: checked ? "#0A0A0A" : "#8A8680",
          transform: `translateX(${checked ? 18 : 2}px)`,
        }}
      />
    </button>
  );
}

function PlanBadge({ plan }: { plan: string }) {
  return (
    <span
      className="text-label inline-flex items-center rounded-sm px-2 py-0.5"
      style={{
        backgroundColor: "var(--color-primary-subtle)",
        color: "var(--color-primary)",
      }}
    >
      {plan}
    </span>
  );
}
