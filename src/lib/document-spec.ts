// BRAND GRENADE — CANONICAL DOCUMENT SECTION SPEC
// ============================================================================
// One shared constant describing, per document type, exactly which sections
// must exist in the rendered output. Nothing may be duplicated per builder and
// nothing may be silently dropped at render time: a stage with no data renders
// a placeholder card so the numbering never skips.
//
// Two layers per document:
//   frontMatter — the canonical Minto argument (01…10), owned by minto.ts
//   appendix    — the numbered evidence cards (01…N), owned by minto-content.ts
//
// The audit harness (scripts/audit-documents.ts) reads this spec and nothing
// else, so a document type cannot pass an audit for a section list it invented.

import { MINTO_SECTIONS, type MintoSectionDef } from "./minto";
import { DETONATION_APPENDIX, PIPELINE_APPENDIX } from "./minto-content";

export type DocumentTypeId =
  | "board_strategy"
  | "exec_summary"
  | "consulting_delivery"
  | "master_detonation";

export interface AppendixSectionDef {
  /** Two-digit printed index. Fixed by position — never renumbered. */
  index: string;
  title: string;
  /** Session column the card is rendered from. */
  key: string;
}

export interface DocumentSpec {
  id: DocumentTypeId;
  /** Display name used by the repository, the builders and the audit table. */
  label: string;
  frontMatter: readonly MintoSectionDef[];
  appendix: readonly AppendixSectionDef[];
}

function numbered(defs: Array<{ title: string; key: string }>): AppendixSectionDef[] {
  return defs.map((d, i) => ({ index: String(i + 1).padStart(2, "0"), ...d }));
}

export const PIPELINE_APPENDIX_SECTIONS = numbered(PIPELINE_APPENDIX);
export const DETONATION_APPENDIX_SECTIONS = numbered(DETONATION_APPENDIX);

export const DOCUMENT_SPECS: Record<DocumentTypeId, DocumentSpec> = {
  board_strategy: {
    id: "board_strategy",
    label: "Board Strategy Recommendation",
    frontMatter: MINTO_SECTIONS,
    appendix: PIPELINE_APPENDIX_SECTIONS,
  },
  exec_summary: {
    id: "exec_summary",
    label: "Strategy Executive Summary",
    frontMatter: MINTO_SECTIONS,
    appendix: PIPELINE_APPENDIX_SECTIONS,
  },
  consulting_delivery: {
    id: "consulting_delivery",
    label: "Consulting Delivery",
    frontMatter: MINTO_SECTIONS,
    appendix: PIPELINE_APPENDIX_SECTIONS,
  },
  master_detonation: {
    id: "master_detonation",
    label: "Master Detonation Brief",
    frontMatter: MINTO_SECTIONS,
    appendix: [...DETONATION_APPENDIX_SECTIONS, ...PIPELINE_APPENDIX_SECTIONS],
  },
};

export const DOCUMENT_SPEC_BY_LABEL: Record<string, DocumentSpec> = Object.fromEntries(
  Object.values(DOCUMENT_SPECS).map((s) => [s.label, s]),
);

/** Placeholder body for a canonical section with no stored output. */
export const NO_STAGE_OUTPUT =
  "No output was recorded for this stage in this session.";
