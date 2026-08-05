// Room 00 — Research Synthesiser.
//
// A standalone, explicitly optional room that sits before the Intelligence
// Lab. Users can dump messy, uncategorised research here and the system sorts,
// verifies and attributes it — or skip the room entirely with one click and go
// straight into the Lab's manual entry flow, exactly as before this room
// existed.

import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { z } from "zod";
import { TopNav } from "@/components/TopNav";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ResearchSynthesiserPanel } from "@/components/intelligence/ResearchSynthesiserPanel";
import { writeSynthesiserHandoff } from "@/lib/synthesiser/handoff";
import { recordSynthesiserRun } from "@/lib/synthesiser/runs";
import type { SynthesiserCategory } from "@/lib/synthesiser/types";

const searchSchema = z.object({ brand: z.string().optional() });

export const Route = createFileRoute("/synthesiser/")({
  validateSearch: (s) => searchSchema.parse(s),
  head: () => ({
    meta: [
      { title: "Research Synthesiser — Brand Grenade" },
      {
        name: "description",
        content:
          "Turn disparate research into strategic intelligence. Diverse inputs. Structured evidence.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SynthesiserRoom,
});


function SynthesiserRoom() {
  const navigate = useNavigate();
  const search = Route.useSearch();
  const [brand, setBrand] = useState(search.brand ?? "");
  const [category, setCategory] = useState("");
  const [runId, setRunId] = useState<string | null>(null);

  function goToLab(fields?: Partial<Record<SynthesiserCategory, string>>) {
    if (fields) {
      writeSynthesiserHandoff({
        brand: brand.trim(),
        category: category.trim(),
        fields,
      });
    }
    navigate({
      to: "/intelligence/new",
      search: brand.trim() ? { brand: brand.trim() } : {},
    });
  }

  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main
        className="py-10 lg:py-12"
        style={{
          paddingLeft: "max(20px, min(32px, 5vw))",
          paddingRight: "max(20px, min(32px, 5vw))",
        }}
      >
        <div className="mx-auto max-w-[1080px]">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <span className="text-label text-text-secondary">
                00 — Research Synthesiser · Optional
              </span>
              <h1 className="text-h2 mt-2 text-text-primary">
                Research Synthesiser
              </h1>
            </div>
            <Link
              to="/intelligence/new"
              search={brand.trim() ? { brand: brand.trim() } : {}}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-[13px] text-text-secondary hover:text-text-primary"
              style={{ border: "1px solid rgba(139,134,128,0.35)" }}
            >
              Skip to Intelligence Lab <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          {/* Working description */}
          <div className="mt-6 max-w-[760px] space-y-3">
            <p className="text-body text-text-secondary">
              Upload or paste your raw research below. The Synthesiser extracts what's
              relevant to brand strategy, verifies public claims, and files everything
              under the correct Intelligence Lab heading — automatically. Accepts PDF,
              DOCX, PPTX, XLSX, CSV, TXT, or pasted text.
            </p>
            <p className="text-[13px] text-text-secondary">
              Already have your research sorted?{" "}
              <Link
                to="/intelligence/new"
                search={brand.trim() ? { brand: brand.trim() } : {}}
                className="underline hover:text-text-primary"
              >
                Skip to Intelligence Lab
              </Link>{" "}
              — this step is optional.
            </p>
          </div>

          {/* Working area */}
          <Card className="mt-8 p-6">
            <h2 className="text-h4 text-text-primary">Brand framing</h2>
            <p className="text-[13px] mt-1 text-text-secondary">
              Used to focus extraction and verification. These carry through to the
              Intelligence Lab.
            </p>
            <div className="mt-5 grid gap-5 md:grid-cols-2">
              <div>
                <Label htmlFor="syn-brand">Brand name</Label>
                <Input
                  id="syn-brand"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  maxLength={200}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="syn-category">Category</Label>
                <Input
                  id="syn-category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  maxLength={200}
                  className="mt-1.5"
                />
              </div>
            </div>
          </Card>

          <div className="mt-8">
            <ResearchSynthesiserPanel
              brand={brand}
              category={category}
              applyLabel="Apply and continue to Intelligence Lab"
              onSynthesised={(claimCount) => {
                void recordSynthesiserRun({
                  id: runId,
                  brandName: brand.trim(),
                  category: category.trim() || null,
                  status: "in_progress",
                  claimCount,
                }).then((id) => setRunId(id));
              }}
              onApply={(fields, claimCount) => {
                void recordSynthesiserRun({
                  id: runId,
                  brandName: brand.trim(),
                  category: category.trim() || null,
                  status: "applied",
                  claimCount,
                });
                goToLab(fields);
              }}
            />
          </div>

        </div>
      </main>
    </div>
  );
}
