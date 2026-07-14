// LOC engine identifiers for the 9-engine rebuild.
//
// Historical LocTaskType constants are retained (unused by the new
// engines) so any residual imports elsewhere in the codebase continue
// to compile. The new engines do not consume task-type constraints.

export const LOC_TASK_TYPES = [
  "total_revitalisation",
  "relevance_extension",
  "challenger_disruption",
  "category_relocation",
  "permission_expansion",
  "crisis_repositioning",
  "cultural_moment_capitalisation",
] as const;

export type LocTaskType = (typeof LOC_TASK_TYPES)[number];

export const LOC_TASK_TYPE_LABEL: Record<LocTaskType, string> = {
  total_revitalisation: "Total Revitalisation",
  relevance_extension: "Relevance Extension",
  challenger_disruption: "Challenger Disruption",
  category_relocation: "Category Relocation",
  permission_expansion: "Permission Expansion",
  crisis_repositioning: "Crisis Repositioning",
  cultural_moment_capitalisation: "Cultural Moment Capitalisation",
};

// The current LOC engines.
export const LOC_ENGINES = [
  "inversion",
  "constraint",
  "wrong_room",
  "delete_customer",
  "worst_case",
  "random_connection",
  "time_displacement",
  "enemy_first",
  "subtract",
  "the_unsayable",
  "the_moment",
  "one_word_ownership",
] as const;

export type EngineName = (typeof LOC_ENGINES)[number];

export const LOC_ENGINE_LABEL: Record<EngineName, string> = {
  inversion: "ENGINE 01 — INVERSION",
  constraint: "ENGINE 02 — CONSTRAINT",
  wrong_room: "ENGINE 03 — WRONG ROOM",
  delete_customer: "ENGINE 04 — DELETE THE CUSTOMER",
  worst_case: "ENGINE 05 — WORST CASE",
  random_connection: "ENGINE 06 — RANDOM CONNECTION",
  time_displacement: "ENGINE 07 — TIME DISPLACEMENT",
  enemy_first: "ENGINE 08 — ENEMY FIRST",
  subtract: "ENGINE 09 — SUBTRACT",
  the_unsayable: "ENGINE 10 — THE UNSAYABLE",
  the_moment: "ENGINE 11 — THE MOMENT",
  one_word_ownership: "ENGINE 12 — ONE WORD OWNERSHIP",
};

